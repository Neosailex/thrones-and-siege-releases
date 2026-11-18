// País y región del jugador para el ranking (S08, diseño 12/11 aprobado por Juan 17/11).
// - Una sola cola y un solo puntaje para todo el mundo; el ranking se puede ver Global, Mi región o Mi país.
// - El país lo elige el jugador (no se adivina por IP) y se puede cambiar UNA vez por temporada (así nadie salta de país
//   para quedar arriba). La bandera se ve al lado del nombre. Se guarda solo el código (ISO 3166-1 alfa-2).
// - Regiones: las del torneo mensual con cupos por región (más adelante).
// Los nombres de países los pone el cliente en el idioma del jugador (Intl.DisplayNames); acá solo códigos.
export const REGIONES = {
  latam: 'AR BO BR CL CO CR CU DO EC GT HN MX NI PA PE PR PY SV UY VE BZ GY SR JM TT HT BS BB',
  norteamerica: 'US CA',
  europa: 'ES PT FR IT DE AT CH BE NL LU IE GB IS NO SE FI DK EE LV LT PL CZ SK HU SI HR BA RS ME MK AL GR BG RO MD UA BY RU MT CY AD MC SM LI XK GE AM AZ',
  asia: 'CN JP KR KP TW HK MO MN IN PK BD LK NP BT MV AF ID MY SG TH VN PH KH LA MM BN TL KZ UZ TM KG TJ',
  'medio-oriente-africa': 'TR IL PS JO LB SY IQ IR SA AE QA BH KW OM YE EG LY TN DZ MA EH MR ML NE TD SD SS ET ER DJ SO KE UG RW BI TZ CD CG GA GQ CM CF NG BJ TG GH CI LR SL GN GW SN GM CV BF ZA NA BW ZW ZM MW MZ AO LS SZ MG MU SC KM',
  oceania: 'AU NZ PG FJ SB VU WS TO KI TV NR PW FM MH',
};
export const PAIS_REGION = {};
for (const [reg, list] of Object.entries(REGIONES)) for (const c of list.split(' ')) PAIS_REGION[c] = reg;
export const esPais = (c) => typeof c === 'string' && c in PAIS_REGION;
export const regionDe = (c) => PAIS_REGION[c] || null;
export const paisesDe = (reg) => (REGIONES[reg] ? REGIONES[reg].split(' ') : null);
