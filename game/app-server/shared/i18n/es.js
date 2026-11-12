// Base de lo compartido que no vive en los datos de cartas/razas (S01, 11/11). Hoy: textos de los códigos que manda
// el servidor (S08, lista y reglas en docs/idiomas/codigos-servidor.md: { code, params } → codes[code]). Castellano actual, tal cual.
export default {
  codes: {
  'player.default': 'Jugador',
  'net.version': 'Hay una versión nueva del juego en el servidor online.',
  'net.tooMany': 'Demasiados intentos desde tu conexión. Esperá un minuto y probá de nuevo.',
  'net.offline': 'No se pudo conectar al servidor.',
  'net.noDb': 'El servidor no tiene base de datos.',
  'auth.identity': 'No se pudo confirmar tu identidad. Recargá el juego.',
  'room.alreadyIn': 'Ya estás en esta sala (¿la tenés abierta en otra pestaña?).',
  'room.full': 'Esa sala ya está completa.',
  'room.notFound': 'No existe una sala con ese código (o ya se cerró).',
  'room.aceTimeout': 'Se acabó el tiempo para elegir el As: la CPU eligió por quien faltaba.',
  'room.turnTimeout': '{name} se quedó sin tiempo: jugó la CPU por él.',
  'deck.invalid': 'Tu mazo no es válido.',
  'deck.tooMany': '{card}: máximo {max} copias.',
  'deck.wrongRace': '{card} es una carta de {race}.',
  'deck.size': 'El mazo tiene {n} cartas y necesita {need}.',
  'deck.replaced': 'Esta partida se juega con el mazo equilibrado de tu raza.',
  'error.unknown': 'Algo salió mal. Probá de nuevo.',
  },
};
