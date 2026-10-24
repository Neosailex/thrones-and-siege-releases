// Huella del motor (S08, 24/10): hash de los archivos de shared/*.js. El cliente calcula la misma huella con los mismos
// archivos (client/src/game/version.js); si no coinciden, el servidor no lo deja entrar y el juego pide actualizar.
// Así una app vieja nunca juega con reglas distintas a las del servidor. Misma función de hash en los dos lados.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const hashText = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }; // FNV-1a 32 bits
export const engVersion = (files) => hashText(Object.keys(files).sort().map((k) => k + '\n' + files[k].replace(/\r\n/g, '\n')).join('\n'));
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'shared');
export const ENG = engVersion(Object.fromEntries(fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).map((f) => [f, fs.readFileSync(path.join(DIR, f), 'utf8')])));
