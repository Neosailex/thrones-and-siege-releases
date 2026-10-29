import { Room, matchMaker } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import * as E from '../shared/engine.js';
import { validateDeck, PRESETS, RACES, STYLE_DECKS, padDeck, CARDS } from '../shared/cards.js';
import * as DB from './db.mjs';
import { ENG } from './version.mjs';
import { cleanName, ipOf, checkJoin, takeSeat, freeSeat } from './abuso.mjs';

// Estado público mínimo (las manos son secretas: cada jugador recibe su propia vista por mensaje).
export const LobbyState = schema({ phase: t.string() }, 'LobbyState');

const TURN_MS = 45000, PENDING_MS = 20000, SLEEVE_MS = 20000, RECONNECT_S = 40, EMOTES = 6; // SLEEVE_MS: tiempo para elegir el As al empezar
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 5, PRIV_WAIT_MS = 15 * 60000; // sala privada: código sin letras que se confunden (I/1, O/0); se cierra si nadie entra en 15 min
const newCode = () => Array.from({ length: CODE_LEN }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
const clean = cleanName; // nombres válidos (abuso.mjs)
const REMATCH_WAIT_MS = 10 * 60000; // sala de amigos: después del final se espera la revancha hasta 10 min
// raza, mazo (validado en el servidor) y carta de la manga (tiene que estar en el mazo) que manda el cliente
function pickDeck(o = {}) {
  const race = RACES[o.race] ? o.race : null;
  const deck = padDeck(Array.isArray(o.deck) && !validateDeck(o.deck, race) ? o.deck.map(Number) : (race ? STYLE_DECKS[race].equilibrado.deck : PRESETS.equilibrado.deck));
  const sleeve = Number.isInteger(o.sleeve) && CARDS[o.sleeve] && deck[o.sleeve - 1] > 0 ? o.sleeve : null;
  return { race, deck, sleeve };
}

export class AsedioRoom extends Room {
  maxClients = 2;
  maxMessagesPerSecond = 20; // un jugador manda pocos mensajes; el que inunda queda afuera (anti-abuso)

  // antes de reservar el lugar: límites por IP (anti-abuso.mjs)
  onAuth(client, _o, ctx) {
    const ip = ipOf(ctx), why = checkJoin(ip); if (why) throw new Error(why);
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
      if (this.seats.every((x) => x.newDeck)) {
        for (const x of this.seats) { Object.assign(x, x.newDeck); x.newDeck = null; x.again = false; }
        this.closeTimer?.clear(); this.finished = false; this.plays = [{}, {}]; this.start();
      }
    });
    if (process.env.ASEDIO_TEST === '1') this.onMessage('__testWin', (c) => { const s = this.seatOf(c); if (this.g && this.g.winner == null && s >= 0) { this.g.winner = s; this.sync([]); this.finish(s, 'normal'); } }); // solo pruebas: terminar la partida ya
    this.onMessage('emote', (c, m) => {
      const seat = this.seatOf(c), s = this.seats[seat]; if (!s) return;
      const i = Number(m?.i); if (!(i >= 0 && i < EMOTES)) return;
      if (Date.now() - (s.lastEmote || 0) < 2500) return; // anti spam
      s.lastEmote = Date.now();
      this.broadcast('emote', { seat, i });
    });
  }

  onJoin(client, o = {}) {
    if (o.eng !== ENG) throw new Error('VERSION'); // cliente con otro motor (app o página vieja): el juego le pide actualizar
    const name = clean(o.name);
    const p = DB.auth(o.pid, o.ptoken, name);
    if (!p) throw new Error('Identidad inválida');
    if (this.seats.some((s) => s.pid === p.id)) throw new Error('Ya estás en esta sala');
    const { race, deck, sleeve } = pickDeck(o);
    this.ips ??= {}; this.ips[client.sessionId] = client.auth?.ip || '?'; takeSeat(this.ips[client.sessionId]); // por sessionId: sigue igual tras reconectar
    this.seats.push({ sessionId: client.sessionId, pid: p.id, pub: p.pub || DB.pubOf(p.id), name, rating: p.rating, connected: true, deck, race, sleeve });
    if (this.seats.length === 2) this.start();
  }

  seatOf(client) { return this.seats.findIndex((s) => s.sessionId === client.sessionId); }
  clientOf(seat) { return this.clients.find((c) => c.sessionId === this.seats[seat]?.sessionId); }
  info(seat) { return { seat, pubs: this.seats.map((s) => s.pub), names: this.seats.map((s) => s.name), ratings: this.seats.map((s) => s.rating), races: this.seats.map((s) => s.race), priv: this.priv }; }

  start() {
    this.lock();
    this.state.phase = 'playing';
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
    if (!g.pending && !events.some((e) => e?.type === 'spyDone' && e.free)) events.push(E.endTurn(g)); // Red de espías: mirar no gasta el turno
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
    if (only != null || keepTimer) return;
    this.timer?.clear();
    if (g.winner == null) this.timer = this.clock.setTimeout(() => this.timeout(), this.deadline - Date.now());
  }

  // Si el jugador no juega a tiempo (o está desconectado), juega la IA Normal por él.
  timeout() {
    const g = this.g; if (!g || g.winner != null) return;
    if (g.phase === 'sleeve') { // no eligieron el As a tiempo: la CPU les guarda la mítica (o su mejor ataque)
      const evs = []; for (let s = 0; s < 2; s++) if (!g.players[s].sleeveDone) { const ev = E.aiChooseSleeve(g, s); if (ev) evs.push(ev); }
      this.broadcast('info', { text: 'Se acabó el tiempo para elegir el As: la CPU eligió por quien faltaba.' });
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
    this.broadcast('info', { text: `${this.seats[seat]?.name ?? ''} se quedó sin tiempo: jugó la CPU por él.` });
    this.advance(evs);
  }

  finish(winner, reason) {
    if (this.finished) return; this.finished = true;
    this.timer?.clear();
    this.state.phase = 'over';
    let ratings = null;
    if (!this.priv) try { ratings = DB.recordMatch({ ids: this.seats.map((s) => s.pid), winner, reason, turns: this.g?.turnNo ?? 0, plays: this.plays, races: this.seats.map((s) => s.race) }); } catch (e) { console.error('No se pudo guardar la partida', e); }
    this.broadcast('over', { winner, reason, ratings });
    this.closeTimer = this.clock.setTimeout(() => this.disconnect(), this.priv && reason !== 'abandon' ? REMATCH_WAIT_MS : 30000);
  }

  // Se cortó la conexión sin salir: se le guarda el lugar un rato.
  onDrop(client) {
    const seat = this.seatOf(client);
    if (this.state.phase !== 'playing' || seat < 0) return;
    this.seats[seat].connected = false;
    this.broadcast('status', { seat, connected: false, seconds: RECONNECT_S });
    this.allowReconnection(client, RECONNECT_S);
  }

  onReconnect(client) {
    const seat = this.seatOf(client); if (seat < 0) return;
    this.seats[seat].connected = true;
    this.broadcast('status', { seat, connected: true });
    client.send('start', { ...this.info(seat), resumed: true });
    if (this.g) this.sync([], seat);
  }

  // Salida definitiva (se fue a propósito o no volvió a tiempo).
  onLeave(client) {
    const ip = this.ips?.[client.sessionId]; if (ip) { freeSeat(ip); delete this.ips[client.sessionId]; }
    const seat = this.seatOf(client);
    if (this.state.phase === 'playing' && this.g && this.g.winner == null && seat >= 0) {
      this.g.winner = 1 - seat;
      this.finish(1 - seat, 'abandon');
    } else if (this.priv && seat >= 0 && (this.state.phase === 'over' || this.state.phase === 'rematch')) { // se fue después del final: no hay revancha
      this.state.phase = 'over'; this.seats[seat].gone = true; this.broadcast('rematchOff', { seat });
      if (this.clients.length === 0) this.disconnect();
    }
  }
}
