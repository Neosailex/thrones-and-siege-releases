// Anti-abuso (S08, 24/10): nombres válidos y límites por conexión (IP).
// En Fly la IP real viene en el encabezado fly-client-ip (no se puede falsificar desde el cliente);
// si no está (local, app de escritorio), la que ve Colyseus.

// ---- nombres ----
// SUB: se buscan dentro del nombre (sin espacios, acentos ni símbolos; 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a).
// PAL: solo como palabra entera (son cortas y aparecen dentro de palabras normales).
// Agregar palabras acá (también de otros idiomas cuando entren los mercados de Asia).
const SUB = ['hijodeputa', 'hdp', 'pelotud', 'conchatu', 'conchesumadre', 'mogolic', 'nigger', 'nigga', 'faggot', 'retard',
  'hitler', 'kkk', 'motherfuck', 'fuck', 'cunt', 'whore', 'pedof', 'pedophil', 'violad', 'putit', 'caralh', 'viad',
  'thronesandsiege', 'moderador', 'administrador'];
const PAL = ['forro', 'nazi', 'nazis', 'puta', 'puto', 'pija', 'verga', 'culo', 'mierda', 'trolo', 'shit', 'bitch', 'dick', 'cock', 'puss', 'admin', 'mod', 'staff', 'soporte', 'support', 'gm'];
const flat = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a');
const INVIS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff<>"`]', 'g');
export function cleanName(s) {
  const n = String(s ?? '').normalize('NFKC')
    .replace(INVIS, '') // invisibles, control y HTML
    .replace(/\s+/g, ' ').trim().slice(0, 16).trim();
  if ([...n].filter((c) => /[\p{L}\p{N}]/u.test(c)).length < 2) return 'Jugador'; // al menos 2 letras o números
  const f = flat(n), joined = f.replace(/[^a-z0-9]/g, ''), words = f.split(/[^a-z0-9]+/).filter(Boolean);
  if (SUB.some((w) => joined.includes(w)) || words.some((w) => PAL.includes(w))) return 'Jugador';
  return n;
}

// ---- límites por IP ----
export const LIM = { seats: 8, joinsPerMin: 30 }; // 8 lugares a la vez por IP (con CGNAT muchos comparten IP), 30 intentos de entrar por minuto
const seats = new Map(), joins = new Map();
export const ipOf = (ctx) => ctx?.headers?.get?.('fly-client-ip') || ctx?.ip || '?';
// devuelve un motivo si no puede entrar, o null
export function checkJoin(ip) {
  const t = Date.now(), list = (joins.get(ip) || []).filter((x) => t - x < 60000); list.push(t); joins.set(ip, list);
  if (list.length > LIM.joinsPerMin) return 'DEMASIADOS';
  if ((seats.get(ip) || 0) >= LIM.seats) return 'DEMASIADOS';
  return null;
}
export const takeSeat = (ip) => seats.set(ip, (seats.get(ip) || 0) + 1);
export const freeSeat = (ip) => { const n = (seats.get(ip) || 0) - 1; if (n > 0) seats.set(ip, n); else seats.delete(ip); };
// limpieza de los intentos viejos (que el mapa no crezca para siempre)
setInterval(() => { const t = Date.now(); for (const [ip, l] of joins) if (!l.some((x) => t - x < 60000)) joins.delete(ip); }, 5 * 60000).unref();
