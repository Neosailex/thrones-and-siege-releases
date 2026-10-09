import { Room } from '@colyseus/core';
import { schema, t } from '@colyseus/schema';
import * as E from '../shared/engine.js';
import { validateDeck, PRESETS, RACES, STYLE_DECKS } from '../shared/cards.js';
import * as DB from './db.mjs';

// Estado público mínimo (las manos son secretas: cada jugador recibe su propia vista por mensaje).
export const LobbyState = schema({ phase: t.string() }, 'LobbyState');

const TURN_MS = 45000, PENDING_MS = 20000, RECONNECT_S = 40, EMOTES = 6;
const clean = (s) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Anónimo';

export class AsedioRoom extends Room {
  maxClients = 2;

  onCreate() {
    this.state = new LobbyState();
    this.state.phase = 'waiting';
    this.seats = []; // [{ sessionId, pid, name, rating, connected, lastEmote }]
    this.plays = [{}, {}];
    this.onMessage('play', (c, m) => this.act(c, () => E.play(this.g, Number(m?.index))));
    this.onMessage('pass', (c) => this.act(c, () => E.passExtra(this.g)));
    this.onMessage('discard', (c, m) => this.act(c, () => E.discard(this.g, Array.isArray(m?.indexes) ? m.indexes.map(Number) : [])));
    this.onMessage('sabotage', (c, m) => this.act(c, () => E.sabotage(this.g, Number(m?.index)), true));
    this.onMessage('spyDone', (c) => this.act(c, () => E.spyDone(this.g), true));
    this.onMessage('cycle', (c, m) => { if (!this.g || this.g.winner != null || this.seatOf(c) !== this.g.turn) return; const ev = E.cycle(this.g, Number(m?.index)); if (ev) this.sync([ev], null, true); });
    // el cliente pide el estado completo (al recargar la página en plena partida)
    this.onMessage('resync', (c) => { const seat = this.seatOf(c); if (seat < 0 || !this.g) return; c.send('start', { ...this.info(seat), resumed: true }); this.sync([], seat); });
    this.onMessage('emote', (c, m) => {
      const seat = this.seatOf(c), s = this.seats[seat]; if (!s) return;
      const i = Number(m?.i); if (!(i >= 0 && i < EMOTES)) return;
      if (Date.now() - (s.lastEmote || 0) < 2500) return; // anti spam
      s.lastEmote = Date.now();
      this.broadcast('emote', { seat, i });
    });
  }

  onJoin(client, o = {}) {
    const name = clean(o.name);
    const p = DB.auth(o.pid, o.ptoken, name);
    if (!p) throw new Error('Identidad inválida');
    if (this.seats.some((s) => s.pid === p.id)) throw new Error('Ya estás en esta sala');
    const race = RACES[o.race] ? o.race : null;
    const deck = Array.isArray(o.deck) && !validateDeck(o.deck, race) ? o.deck.map(Number) : (race ? STYLE_DECKS[race].equilibrado.deck : PRESETS.equilibrado.deck); // mazo validado en el servidor
    this.seats.push({ sessionId: client.sessionId, pid: p.id, name, rating: p.rating, connected: true, deck, race });
    if (this.seats.length === 2) this.start();
  }

  seatOf(client) { return this.seats.findIndex((s) => s.sessionId === client.sessionId); }
  clientOf(seat) { return this.clients.find((c) => c.sessionId === this.seats[seat]?.sessionId); }
  info(seat) { return { seat, names: this.seats.map((s) => s.name), ratings: this.seats.map((s) => s.rating), races: this.seats.map((s) => s.race) }; }

  start() {
    this.lock();
    this.state.phase = 'playing';
    this.g = E.newGame({ starter: Math.random() < 0.5 ? 0 : 1, decks: this.seats.map((x) => x.deck), races: this.seats.map((x) => x.race) });
    for (const [seat] of this.seats.entries()) this.clientOf(seat)?.send('start', this.info(seat));
    this.sync([]);
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
    if (!g.pending) events.push(E.endTurn(g));
    this.sync(events);
    if (g.winner != null) this.finish(g.winner, 'normal');
  }

  sync(events, only = null, keepTimer = false) {
    const g = this.g;
    if (only == null && !keepTimer) this.deadline = g.winner != null ? 0 : Date.now() + (g.pending ? PENDING_MS : TURN_MS);
    for (const [seat] of this.seats.entries()) {
      const c = this.clientOf(seat); if (!c || (only != null && seat !== only)) continue;
      const evs = events.map((e) => (e.type === 'discard' && e.seat !== seat ? { ...e, cards: e.cards.map(() => 0) } : e));
      c.send('update', { view: E.viewFor(g, seat), events: evs, deadline: this.deadline });
    }
    if (only != null || keepTimer) return;
    this.timer?.clear();
    if (g.winner == null) this.timer = this.clock.setTimeout(() => this.timeout(), this.deadline - Date.now());
  }

  // Si el jugador no juega a tiempo (o está desconectado), juega la IA Normal por él.
  timeout() {
    const g = this.g; if (!g || g.winner != null) return;
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
    try { ratings = DB.recordMatch({ ids: this.seats.map((s) => s.pid), winner, reason, turns: this.g?.turnNo ?? 0, plays: this.plays }); } catch (e) { console.error('No se pudo guardar la partida', e); }
    this.broadcast('over', { winner, reason, ratings });
    this.clock.setTimeout(() => this.disconnect(), 30000);
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
    const seat = this.seatOf(client);
    if (this.state.phase === 'playing' && this.g && this.g.winner == null && seat >= 0) {
      this.g.winner = 1 - seat;
      this.finish(1 - seat, 'abandon');
    }
  }
}
