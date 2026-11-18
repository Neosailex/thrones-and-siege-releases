import { Room, matchMaker } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import * as E from '../shared/engine.js';
import { validateDeck, PRESETS, RACES, STYLE_DECKS, padDeck, CARDS } from '../shared/cards.js';
import * as DB from './db.mjs';
import { ENG } from './version.mjs';
import { joinError, deckProblem } from './codigos.mjs';
import { cleanName, ipOf, checkJoin, takeSeat, freeSeat } from './abuso.mjs';
import * as GH from './fantasmas.mjs';
import * as FD from './fondos.mjs';
import * as HO from './hora.mjs';
import * as CPU from './cpu.mjs';

// Estado público mínimo (las manos son secretas: cada jugador recibe su propia vista por mensaje).
export const LobbyState = schema({ phase: t.string() }, 'LobbyState');

const TURN_MS = 45000, PENDING_MS = 20000, SLEEVE_MS = 20000, RECONNECT_S = 40, EMOTES = 6;
const CPU_RECONNECT_S = 30 * 60; // (18/11) mientras juega la CPU por él, puede volver hasta 30 min (o hasta que termine la partida) // SLEEVE_MS: tiempo para elegir el As al empezar
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 5, PRIV_WAIT_MS = 15 * 60000; // sala privada: código sin letras que se confunden (I/1, O/0); se cierra si nadie entra en 15 min
const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
const clean = cleanName; // nombres válidos (abuso.mjs)
const REMATCH_WAIT_MS = 10 * 60000; // sala de amigos: después del final se espera la revancha hasta 10 min
// raza, mazo (validado en el servidor) y carta de la manga (tiene que estar en el mazo) que manda el cliente
// Si el mazo no vale, se juega con el equilibrado de esa raza y se avisa con un código (deckIssue) para el cliente.
function pickDeck(o = {}) {
  const race = RACES[o.race] ? o.race : null;
  const issue = Array.isArray(o.deck) ? deckProblem(o.deck.map(Number), race) : null;
  const ok = Array.isArray(o.deck) && !issue && !validateDeck(o.deck, race);
  const deck = padDeck(ok ? o.deck.map(Number) : (race ? STYLE_DECKS[race].equilibrado.deck : PRESETS.equilibrado.deck));
  const sleeve = Number.isInteger(o.sleeve) && CARDS[o.sleeve] && deck[o.sleeve - 1] > 0 ? o.sleeve : null;
  return { race, deck, sleeve, deckIssue: Array.isArray(o.deck) && !ok ? issue || { code: 'deck.invalid' } : null };
}

// Jugada "de novato" para el bot: una carta jugable al azar, o descartar una al azar
function torpe(g) {
  const p = g.players[g.turn], ok = p.hand.map((_, k) => k).filter((k) => E.playable(p, p.hand[k]));
  return ok.length && Math.random() < 0.6 ? { type: 'play', index: ok[Math.floor(Math.random() * ok.length)] } : { type: 'discard', indexes: [Math.floor(Math.random() * p.hand.length)] };
}

export class AsedioRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 20; // un jugador manda pocos mensajes; el que inunda queda afuera (anti-abuso)

  // antes de reservar el lugar: límites por IP (anti-abuso.mjs)
  onAuth(client, _o, ctx) {
    const ip = ipOf(ctx), why = checkJoin(ip); if (why) throw joinError('net.tooMany', why);
    return { ip };
  }

  // Sala privada ('amigos'): el id de la sala ES el código que se comparte (el amigo entra con joinById). No suma al ranking.
  async onCreate(o = {}) {
    this.priv = !!o.priv;
    if (this.priv) {
      let code = newCode(); for (let i = 0; i < 20 && (await matchMaker.query({ roomId: code })).length; i++) code = newCode();
      this.roomId = code;
      this.clock.setTimeout(() => { if (this.seats.length < 2) this.disconnect(); }, PRIV_WAIT_MS);
    }
    this.state = new LobbyState();
    this.state.phase = 'waiting';
    this.seats = []; // [{ sessionId, pid, name, rating, connected, lastEmote }]
    this.plays = [{}, {}];
    this.onMessage('play', (c, m) => this.act(c, () => E.play(this.g, m?.index === 'sleeve' ? 'sleeve' : Number(m?.index), m?.choice && typeof m.choice === 'object' ? { give: String(m.choice.give), get: String(m.choice.get), n: Number(m.choice.n) } : null))); // index 'sleeve' = jugar la carta de la manga
    // Fase 'sleeve' (al empezar): los dos eligen su As a la vez; cuando eligió el segundo, el motor reparte (ev.deal) y arranca el primer turno
    this.onMessage('sleeve', (c, m) => {
      const g = this.g; if (!g || g.winner != null || g.phase !== 'sleeve') return; const seat = this.seatOf(c); if (seat < 0) return;
      const ev = E.chooseSleeve(g, seat, m?.id == null ? null : Number(m.id)); if (!ev) return;
      this.sync([ev], null, !ev.deal); // con el reparto arranca el reloj del turno; si no, sigue el de la elección
    });
    this.onMessage('pass', (c) => this.act(c, () => E.passExtra(this.g)));
    this.onMessage('discard', (c, m) => this.act(c, () => E.discard(this.g, Array.isArray(m?.indexes) ? m.indexes.map(Number) : [], m?.pick && typeof m.pick === 'object' ? { card: Number(m.pick.card), res: String(m.pick.res) } : null)));
    this.onMessage('sabotage', (c, m) => this.act(c, () => E.sabotage(this.g, Number(m?.index)), true));
    this.onMessage('spyDone', (c) => this.act(c, () => E.spyDone(this.g), true));
    this.onMessage('cycle', (c, m) => { if (!this.g || this.g.winner != null || this.seatOf(c) !== this.g.turn) return; const ev = E.cycle(this.g, Number(m?.index)); if (ev) this.sync([ev], null, true); });
    // el cliente pide el estado completo (al recargar la página en plena partida)
    this.onMessage('resync', (c) => { const seat = this.seatOf(c); if (seat < 0 || !this.g) return; c.send('start', { ...this.info(seat), resumed: true }); this.sync([], seat); });
    // Revancha (Juan 28/10, solo sala de amigos): al terminar, uno la pide y el otro la acepta (o la pide también);
    // los dos eligen raza, mazo y As de nuevo y, cuando eligió el segundo, arranca otra partida en la misma sala.
    this.onMessage('rematch', (c) => {
      const seat = this.seatOf(c); if (!this.priv || this.state.phase !== 'over' || seat < 0 || this.seats.length < 2 || this.seats.some((x) => x.gone)) return;
      this.seats[seat].again = true; this.broadcast('rematch', { seat });
      if (this.seats.every((x) => x.again)) { this.state.phase = 'rematch'; for (const x of this.seats) x.newDeck = null; this.broadcast('rematchGo', {}); }
    });
    this.onMessage('rematchDeck', (c, m) => {
      const seat = this.seatOf(c); if (this.state.phase !== 'rematch' || seat < 0) return;
      this.seats[seat].newDeck = pickDeck(m || {}); this.broadcast('rematchReady', { seat });
      if (this.seats[seat].newDeck.deckIssue) c.send('notice', { ...this.seats[seat].newDeck.deckIssue, replaced: true });
      if (this.seats.every((x) => x.newDeck)) {
        for (const x of this.seats) { Object.assign(x, x.newDeck); x.newDeck = null; x.again = false; }
        this.closeTimer?.clear(); this.finished = false; this.plays = [{}, {}]; this.start();
      }
    });
    if (process.env.ASEDIO_TEST === '1') this.onMessage('__testSet', (c, m) => { const s = this.seatOf(c), p = this.g?.players[s]; if (!p) return; if (m.hand) p.hand[m.hand[0]] = m.hand[1]; Object.assign(p, m.set || {}); if (m.op) Object.assign(this.g.players[1 - s], m.op); this.sync([]); }); // solo pruebas: poner una carta en la mano / valores
    if (process.env.ASEDIO_TEST === '1') this.onMessage('__testWin', (c, m) => { const s = this.seatOf(c); if (this.g && this.g.winner == null && s >= 0) { if (m?.turns) this.g.turnNo = Math.max(this.g.turnNo, m.turns); this.g.winner = s; this.sync([]); this.finish(s, 'normal'); } }); // solo pruebas: terminar la partida ya
    // Sin rival (S08 14/11): el que espera pide jugar contra un fantasma de su nivel (si no hay, un bot "CPU entrenada").
    // El lugar del rival lo juega el servidor con la IA del motor; se ve siempre como fantasma/CPU, nunca como persona.
    this.onMessage('cpu', (c) => { if (this.seatOf(c) === 0) this.addAi(false); }); // "Jugar contra un fantasma" (a los 25 s)
    this.onMessage('emote', (c, m) => {
      const seat = this.seatOf(c), s = this.seats[seat]; if (!s) return;
      const i = Number(m?.i); if (!(i >= 0 && i < EMOTES)) return;
      if (Date.now() - (s.lastEmote || 0) < 2500) return; // anti spam
      s.lastEmote = Date.now();
      this.broadcast('emote', { seat, i });
    });
  }

  onJoin(client, o = {}) {
    if (o.eng !== ENG) throw joinError('net.version', 'VERSION'); // cliente con otro motor (app o página vieja): el juego le pide actualizar
    const name = clean(o.name);
    const p = DB.auth(o.pid, o.ptoken, name);
    if (!p) throw joinError('auth.identity');
    if (this.seats.some((s) => s.pid === p.id)) throw joinError('room.alreadyIn');
    const { race, deck, sleeve, deckIssue } = pickDeck(o);
    if (deckIssue) client.send('notice', { ...deckIssue, replaced: true }); // mazo que no vale: se juega con el equilibrado
    this.ips ??= {}; this.ips[client.sessionId] = client.auth?.ip || '?'; takeSeat(this.ips[client.sessionId]); // por sessionId: sigue igual tras reconectar
    this.seats.push({ sessionId: client.sessionId, pid: p.id, pub: p.pub || DB.pubOf(p.id), name, rating: p.rating, connected: true, deck, race, sleeve, fondo: FD.paraPartida(p.id, o.fondo), // set de fondo (validado: solo si lo tiene)
      since: Date.now() - Math.max(0, Math.min(600e3, Number(o.waitedMs) || 0)), games: p.games || 0 }); // cuánto viene esperando (aunque haya cambiado de sala)
    if (this.seats.length === 1 && !this.priv) {
      this.setMetadata({ rating: p.rating, since: Date.now() }); // para el emparejamiento por nivel (/api/buscar)
      const d = GH.botDelayMs(p); // rangos bajos: si no aparece nadie, bot "CPU entrenada"
      if (d != null) this.botTimer = this.clock.setTimeout(() => this.addAi(true), Math.max(500, d - (Date.now() - this.seats[0].since)));
    }
    if (this.seats.length === 2) this.start();
  }

  // Rival manejado por el servidor: fantasma de tu nivel (o bot si no hay). bot = true: el bot de rangos bajos (a los 5-12 s)
  addAi(bot) {
    this.botTimer?.clear();
    if (this.priv || this.state.phase !== 'waiting' || this.seats.length !== 1) return;
    const me = this.seats[0], gh = (!bot && GH.pickGhost(me.pid, me.rating)) || GH.makeBot(me.rating, me.pid), kind = gh.owner ? 'fantasma' : 'bot';
    const level = kind === 'bot' ? (me.games < 10 || me.rating < 1000 ? 'facil' : Math.random() < 0.5 ? 'facil' : 'normal') : GH.aiLevel(gh.rating);
    this.seats.push({ sessionId: null, ai: true, kind, owner: gh.owner, pid: null, pub: null, name: gh.name, rating: gh.rating, connected: true, deck: gh.deck, race: gh.race, sleeve: gh.sleeve, fondo: gh.fondo || 'a',
      level, blunder: kind === 'bot' ? GH.botTorpeza(me.pid) : 0 });
    this.aiSeat = 1; this.start();
  }

  seatOf(client) { return this.seats.findIndex((s) => s.sessionId === client.sessionId); }
  clientOf(seat) { return this.clients.find((c) => c.sessionId === this.seats[seat]?.sessionId); }
  info(seat) { return { seat, pubs: this.seats.map((s) => s.pub), names: this.seats.map((s) => s.name), ratings: this.seats.map((s) => s.rating), races: this.seats.map((s) => s.race), priv: this.priv,
    kinds: this.seats.map((s) => s.kind || 'persona'), fondos: this.seats.map((s) => s.fondo || 'a'), botLabel: process.env.BOT_CARTEL !== '0' }; } // kinds: persona | fantasma | bot (el cliente muestra "Fantasma de X" / "CPU entrenada")

  start() {
    this.lock();
    if (!this.priv) this.setMetadata({ rating: null, since: null }); // ya no espera: que /api/buscar no la ofrezca aunque alguien se vaya y quede 1
    if (!this.priv && !this.started) { this.started = true; GH.stat(this.seats[1]?.kind || 'persona', Date.now() - (this.seats[0]?.since || Date.now())); } // para /stats
    this.state.phase = 'playing';
    this.autoDispose = false;                       // (18/11) si se van los dos, la CPU termina igual la partida (la cierra finish)
    this.cpu = [false, false]; this.cpuTurns = [0, 0]; this.turnos = [0, 0];
    this.g = E.newGame({ starter: Math.random() < 0.5 ? 0 : 1, decks: this.seats.map((x) => x.deck), races: this.seats.map((x) => x.race), setup: true }); // arranca en la fase de elegir el As
    for (const [seat] of this.seats.entries()) this.clientOf(seat)?.send('start', this.info(seat));
    const pre = []; for (const [seat, x] of this.seats.entries()) if (x.sleeve != null) { const ev = E.chooseSleeve(this.g, seat, x.sleeve); if (ev) pre.push(ev); } // "Guardar mítica siempre": el As ya viene elegido desde el cliente
    this.sync(pre);
  }

  act(client, fn, pendingAction = false) {
    if (!this.g || this.g.winner != null) return;
    const seat = this.seatOf(client);
    if (seat !== this.g.turn) return;
    if (!!this.g.pending !== pendingAction) return;
    const ev = fn(); if (!ev) return;
    this.advance([ev]);
  }

  advance(events) {
    const g = this.g;
    for (const e of events) if (e?.type === 'play') this.plays[e.seat][e.card] = (this.plays[e.seat][e.card] || 0) + 1;
    if (!g.pending && !events.some((e) => e?.type === 'spyDone' && e.free)) { // Red de espías: mirar no gasta el turno
      const t = g.turn; if (this.turnos) { this.turnos[t]++; if (this.cpu?.[t]) this.cpuTurns[t]++; } // turnos de cada uno (y cuántos jugó la CPU por él)
      events.push(E.endTurn(g));
    }
    this.sync(events);
    if (g.winner != null) this.finish(g.winner, 'normal');
  }

  sync(events, only = null, keepTimer = false) {
    const g = this.g;
    if (only == null && !keepTimer) this.deadline = g.winner != null ? 0 : Date.now() + (g.phase === 'sleeve' ? SLEEVE_MS : g.pending ? PENDING_MS : TURN_MS);
    for (const [seat] of this.seats.entries()) {
      const c = this.clientOf(seat); if (!c || (only != null && seat !== only)) continue;
      const evs = E.eventsFor(events, seat).map((e) => (e.type === 'discard' && e.seat !== seat ? { ...e, cards: e.cards.map(() => 0) } : e)); // trampas ocultas: la del rival llega tapada
      c.send('update', { view: E.viewFor(g, seat), events: evs, deadline: this.deadline });
    }
    if (only == null) this.scheduleAi();
    if (only != null || keepTimer) return;
    this.timer?.clear();
    if (g.winner == null) this.timer = this.clock.setTimeout(() => this.timeout(), this.deadline - Date.now());
  }

  // ---- la IA: el rival fantasma/bot (aiSeat) o la CPU Normal por el que se desconectó (this.cpu[seat], 18/11) ----
  aiLevel(seat) { const x = this.seats[seat]; return x?.ai ? x.level || 'normal' : this.cpu?.[seat] ? 'normal' : null; }
  aiNeeds() { // el asiento al que le toca y lo maneja la IA, o -1
    const g = this.g; if (!g || g.winner != null || this.finished) return -1;
    if (g.phase === 'sleeve') { for (let s = 0; s < 2; s++) if (!g.players[s].sleeveDone && this.aiLevel(s)) return s; return -1; }
    const s = g.pending ? g.pending.seat : g.turn; return this.aiLevel(s) ? s : -1;
  }
  scheduleAi() {
    this.aiTimer?.clear(); const ai = this.aiNeeds(); if (ai < 0) return;
    const g = this.g, cpu = !this.seats[ai].ai; // la CPU por un desconectado juega un poco más rápido
    const wait = g.phase === 'sleeve' ? (cpu ? 800 : 1500 + Math.random() * 2000) : g.pending ? 900 : cpu ? 900 + Math.random() * 600 : 1200 + Math.random() * 1300;
    this.aiTimer = this.clock.setTimeout(() => this.aiAct(), wait);
  }
  aiAct() {
    const g = this.g, ai = this.aiNeeds(); if (ai < 0) return;
    if (g.phase === 'sleeve') { const ev = E.aiChooseSleeve(g, ai); if (ev) this.sync([ev], null, !ev.deal); return; }
    const evs = [], lvl = this.aiLevel(ai);
    if (g.pending?.type === 'sabotage') evs.push(E.sabotage(g, E.aiSabotageSmart(g)));
    else if (g.pending?.type === 'spy') evs.push(E.spyDone(g));
    else {
      const cy = E.aiMaybeCycle(g); if (cy) evs.push(cy);
      let a = E.aiChooseLevel(g, lvl);
      if (this.seats[ai].blunder && Math.random() < this.seats[ai].blunder) a = torpe(g); // bot de rangos bajos: cada tanto una jugada cualquiera
      let ev = a.type === 'play' ? E.play(g, a.index) : E.discard(g, a.indexes);
      if (!ev) { a = E.aiChooseLevel(g, lvl); ev = a.type === 'play' ? E.play(g, a.index) : E.discard(g, a.indexes); }
      if (!ev) return;
      if (!this.seats[ai].ai) ev.cpu = true; // jugada de la CPU por el desconectado (el cliente lo puede marcar)
      evs.push(ev);
      if (g.pending?.type === 'sabotage' && g.pending.seat === ai) evs.push(E.sabotage(g, E.aiSabotageSmart(g)));
      if (g.pending?.type === 'spy' && g.pending.seat === ai) evs.push(E.spyDone(g));
    }
    this.advance(evs); // igual que una jugada de persona (fin de turno, ganar)
  }

  // Si el jugador no juega a tiempo (o está desconectado), juega la IA Normal por él.
  timeout() {
    const g = this.g; if (!g || g.winner != null) return;
    if (g.phase === 'sleeve') { // no eligieron el As a tiempo: la CPU les guarda la mítica (o su mejor ataque)
      const evs = []; for (let s = 0; s < 2; s++) if (!g.players[s].sleeveDone) { const ev = E.aiChooseSleeve(g, s); if (ev) evs.push(ev); }
      this.broadcast('info', { code: 'room.aceTimeout', text: 'Se acabó el tiempo para elegir el As: la CPU eligió por quien faltaba.' }); // text: solo para clientes viejos
      return this.sync(evs);
    }
    const seat = g.pending?.seat ?? g.turn, evs = [];
    if (g.pending?.type === 'sabotage') evs.push(E.sabotage(g, E.aiSabotageSmart(g)));
    else if (g.pending?.type === 'spy') evs.push(E.spyDone(g));
    else {
      const cy = E.aiMaybeCycle(g); if (cy) evs.push(cy);
      const a = E.aiChooseLevel(g, 'normal');
      const ev = a.type === 'play' ? E.play(g, a.index) : E.discard(g, a.indexes); if (!ev) return;
      ev.auto = true; evs.push(ev);
      if (g.pending?.type === 'sabotage') evs.push(E.sabotage(g, E.aiSabotageSmart(g)));
      if (g.pending?.type === 'spy') evs.push(E.spyDone(g));
    }
    this.broadcast('info', { code: 'room.turnTimeout', params: { seat, name: this.seats[seat]?.name ?? '' }, text: `${this.seats[seat]?.name || 'Jugador'} se quedó sin tiempo: jugó la CPU por él.` }); // text: solo para clientes viejos
    this.advance(evs);
  }

  finish(winner, reason) {
    if (this.finished) return; this.finished = true;
    this.timer?.clear();
    this.state.phase = 'over';
    let ratings = null;
    if (this.priv && (winner === 0 || winner === 1)) { this.score ??= [0, 0]; this.score[winner]++; } // (Juan 01/11) marcador entre amigos, a lo largo de las revanchas
    this.aiTimer?.clear();
    if (!this.priv && this.aiSeat != null) try { // contra fantasma o bot: solo cuenta para la persona, a la mitad; el dueño del fantasma solo suma
      const h = 1 - this.aiSeat, x = this.seats[this.aiSeat];
      const r = DB.recordVsAi({ id: this.seats[h].pid, seat: h, aiRating: x.rating, owner: x.owner, kind: x.kind, winner, reason, turns: this.g?.turnNo ?? 0, plays: this.plays[h], races: this.seats.map((s) => s.race) });
      ratings = [null, null]; ratings[h] = r;
      if (x.kind === 'fantasma') GH.ownerResult(x.owner, this.seats[h].pid, winner === this.aiSeat);
    } catch (e) { console.error('No se pudo guardar la partida', e); }
    else if (!this.priv) try {
      const scale = this.seats.map((s, i) => CPU.escala({ cpuTurns: this.cpuTurns?.[i], myTurns: this.turnos?.[i], won: winner === i, pid: s.pid })); // (18/11) la CPU jugó la mayor parte por él: la mitad
      ratings = DB.recordMatch({ ids: this.seats.map((s) => s.pid), winner, reason, turns: this.g?.turnNo ?? 0, plays: this.plays, races: this.seats.map((s) => s.race), scale });
      if ((this.g?.turnNo ?? 0) >= 4) GH.saveGhosts(this.seats); // cada partida con ranking deja el fantasma de los dos
    } catch (e) { console.error('No se pudo guardar la partida', e); }
    let hora = null; // Hora del asedio: progreso de cada persona (si la ventana está abierta)
    if (!this.priv) try { hora = this.seats.map((s, i) => (s.ai ? null : HO.partida(s.pid, { turns: this.g?.turnNo ?? 0, abandono: (reason === 'abandon' && winner === 1 - i) || CPU.escala({ cpuTurns: this.cpuTurns?.[i], myTurns: this.turnos?.[i] }) < 1 }))); } catch (e) { console.error('Hora del asedio', e); }
    for (const [i, x] of this.seats.entries()) if (this.cpu?.[i] && !x.ai && x.pid) { // terminó sin él: informe para cuando vuelva
      const r = ratings?.[i]; CPU.informe({ pid: x.pid, rival: this.seats[1 - i]?.kind === 'fantasma' || this.seats[1 - i]?.kind === 'bot' ? '' : this.seats[1 - i]?.name, turnos: this.cpuTurns[i], total: this.turnos[i], gano: winner === i, delta: r ? r.after - r.before : null });
    }
    this.broadcast('over', { winner, reason, ratings, ...(hora?.some(Boolean) ? { hora } : {}), ...(this.priv ? { score: this.score || [0, 0] } : {}) });
    this.closeTimer = this.clock.setTimeout(() => this.disconnect(), this.priv && reason !== 'abandon' ? REMATCH_WAIT_MS : 30000);
  }

  // Se cortó la conexión sin salir: se le guarda el lugar un rato.
  // (18/11) Mientras tanto juega la CPU Normal por él, al instante: el rival no espera. Puede volver hasta que termine.
  onDrop(client) {
    const seat = this.seatOf(client);
    if (this.state.phase !== 'playing' || seat < 0) return;
    this.seats[seat].connected = false;
    const cpu = !!(this.g && this.g.winner == null && this.cpu);
    if (cpu) { this.cpu[seat] = true; CPU.corte(this.seats[seat].pid); }
    this.broadcast('status', { seat, connected: false, cpu, seconds: cpu ? 0 : RECONNECT_S });
    this.allowReconnection(client, cpu ? CPU_RECONNECT_S : RECONNECT_S);
    if (cpu) this.scheduleAi();
  }

  onReconnect(client) {
    const seat = this.seatOf(client); if (seat < 0) return;
    this.seats[seat].connected = true;
    const tomo = this.cpu?.[seat] ? this.cpuTurns[seat] : 0;
    if (this.cpu) this.cpu[seat] = false;            // retoma el control
    this.broadcast('status', { seat, connected: true });
    client.send('start', { ...this.info(seat), resumed: true, cpuTurnos: tomo });
    if (this.g && this.g.winner == null) this.scheduleAi(); // si la CPU estaba por jugar su turno, ya no
    if (this.g) this.sync([], seat);
  }

  // Salida definitiva (se fue a propósito o no volvió a tiempo).
  onLeave(client) {
    const ip = this.ips?.[client.sessionId]; if (ip) { freeSeat(ip); delete this.ips[client.sessionId]; }
    const seat = this.seatOf(client);
    if (this.state.phase === 'playing' && this.g && this.g.winner == null && seat >= 0 && this.cpu?.[seat]) {
      this.seats[seat].gone = true; // no volvió a tiempo: la CPU sigue hasta el final (18/11)
    } else if (this.state.phase === 'playing' && this.g && this.g.winner == null && seat >= 0) {
      this.g.winner = 1 - seat;
      this.finish(1 - seat, 'abandon');
    } else if (this.priv && seat >= 0 && (this.state.phase === 'over' || this.state.phase === 'rematch')) { // se fue después del final: no hay revancha
      this.state.phase = 'over'; this.seats[seat].gone = true; this.broadcast('rematchOff', { seat });
      if (this.clients.length === 0) this.disconnect();
    }
  }
}
