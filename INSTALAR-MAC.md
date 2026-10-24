# Cómo abrir Thrones & Siege en Mac (mientras no esté firmado por Apple)

1. Bajá el .dmg que corresponda: **Mac-arm64** si tu Mac es M1/M2/M3/M4 (Apple Silicon), **Mac-x64** si es Intel
   (menú  > Acerca de esta Mac: si dice "Chip Apple" es arm64; si dice "Procesador Intel" es x64).
2. Abrí el .dmg y arrastrá **Asedio** (el nombre interno; pronto pasa a Thrones & Siege) a la carpeta **Aplicaciones**.
3. La primera vez, en Aplicaciones: **clic derecho sobre el juego > Abrir > Abrir**. Desde ahí abre normal.
4. Si dice "no se puede abrir" o "está dañado": abrí **Ajustes del Sistema > Privacidad y seguridad**, bajá hasta
   "Asedio se bloqueó" y tocá **Abrir igualmente**.
   Si aun así dice "dañado", abrí la app Terminal y pegá:  `xattr -cr "/Applications/Asedio.app"`

# Linux
Bajá el .AppImage, dale permiso de ejecución (clic derecho > Propiedades > Permitir ejecutar, o `chmod +x`) y abrilo.
En Ubuntu 22.04+ puede hacer falta `sudo apt install libfuse2`.
