# Claude Street

Juego de pelea 3D para **dos jugadores en el mismo teclado**, con mandos, u **online con dos móviles**, al estilo de los clásicos de ring cuadrado: combates a 2 rondas, golpes altos/medios/bajos, esquivas laterales, agarres y **ring out**.

La arena (ring, estanque, antorchas, gradas y público) está modelada en Blender (`Arena_Pelea.blend`) y exportada a glTF. El juego corre en el navegador con [Three.js](https://threejs.org/), sin instalar nada.

**Jugar:** https://simonrovi-web.github.io/claude-street/

## Luchadores

Antes de cada combate se elige luchador. Si los dos eligen el mismo, el segundo sale con colores alternativos.

| Luchador | Estilo | Poder | Velocidad | Peso |
|---|---|---|---|---|
| **Kaito**, el Puño Carmesí | Karate tradicional | Medio | Media | Medio |
| **Rina**, Tormenta Azul | Kickboxing callejero | Bajo | Alta | Bajo |
| **Voss**, el Martillo de Hierro | Gladiador acorazado | Muy alto | Baja | Muy alto |
| **Nyx**, Sombra sin Rostro | Asesina encapuchada | Medio | Muy alta | Bajo |
| **Torak**, Furia de las Montañas | Guerrero tribal | Alto | Media | Alto |
| **Sera**, Loto Dorado | Monja guerrera | Medio | Alta | Medio |

### Golpes especiales y energía

Cada luchador tiene un especial propio. Se lanza con la tecla de especial (`R` el J1, `P` el J2, `Y` en el mando, botón ESPECIAL en el móvil) o pulsando **puño y patada a la vez**. Gasta media barra de energía; la barra está debajo de la vida y se llena al golpear, al recibir golpes y al bloquear.

| Luchador | Especial | Qué hace |
|---|---|---|
| Kaito | Puño del Dragón | Gancho ascendente que lanza al rival por los aires |
| Rina | Tormenta | Avanza con tres patadas seguidas; la última derriba |
| Voss | Martillo Sísmico | Golpe al suelo con onda baja de largo alcance (hay que bloquear agachado) |
| Nyx | Paso Sombra | Desaparece y ataca por la espalda |
| Torak | Embestida | Carga con el hombro que arrastra al rival más de 3 metros: perfecta para sacar del ring |
| Sera | Palma del Loto | Esfera de energía a distancia |

*Poder* multiplica el daño, *Velocidad* la rapidez al moverse y esquivar, y *Peso* reduce cuánto te empujan los golpes (más difícil sacarte del ring).

Selección: J1 con `A` `D` `W` `S` y `F` para confirmar (`G` para cambiar); J2 con las flechas y `K` (`L` para cambiar). Con ratón o pantalla táctil, toca un luchador y vuelve a tocarlo para confirmar.

## Música

Cuatro temas originales en Re menor a 140 BPM, compuestos en Ableton Live: **Menú** (épico y pausado), **Selección** (arpegios), **Combate** (16 compases, agresivo) y **Victoria** (fanfarria). Cada uno tiene melodía, bajo, acordes y batería.

- En Ableton están en la vista Session: una escena por tema y las pistas *Melodía*, *Bajo*, *Acordes* y *Batería*.
- Las notas están en `docs/assets/musica.json` y el juego las toca con sintetizadores propios (Web Audio), así que no hay archivos de audio que descargar.
- `tools/componer.py` es el script que genera las notas: si cambias la composición, vuelve a ejecutarlo para actualizar el JSON.
- `M` activa o quita la música (también hay un botón en el menú y en la pausa).

## Jugar con dos móviles

1. Los dos abrís el enlace de arriba en el navegador del móvil y lo ponéis en horizontal.
2. Uno pulsa **Online · 2 móviles → Crear sala**. Le sale un código de 4 letras (o puede pulsar *Enviar invitación* para mandar un enlace por WhatsApp, etc.).
3. El otro pulsa **Online · 2 móviles → Unirme a una sala** y escribe el código (o abre el enlace de invitación).
4. El combate empieza solo. Quien crea la sala juega con Kaito; quien se une, con Rina.

Controles táctiles: joystick a la izquierda (arriba salta, abajo agacha) y botones de puño, patada, guardia y esquiva (fondo/frente) a la derecha. También funciona entre dos ordenadores, o un móvil y un ordenador.

Cómo funciona: los móviles se conectan directamente entre sí con WebRTC ([PeerJS](https://peerjs.com/)); el servidor público de PeerJS solo se usa para encontrarse con el código. El móvil que crea la sala simula el combate y el otro envía sus controles y recibe lo que pasa. En la misma WiFi va mejor; con datos móviles algunas operadoras bloquean las conexiones directas y puede no conectar.

## Controles de teclado

| Acción | Jugador 1 (Kaito) | Jugador 2 (Rina) |
|---|---|---|
| Moverse | `A` `D` | `←` `→` |
| Saltar / agacharse | `W` `S` | `↑` `↓` |
| Esquivar (fondo / frente) | `Q` `E` | `I` `O` (o `Num4` `Num5`) |
| Puño | `F` | `K` (o `Num1`) |
| Patada | `G` | `L` (o `Num2`) |
| Guardia | `H` | `Ñ` (o `Num3`) |
| Especial | `R` (o puño + patada) | `P` (o `Num6`, o puño + patada) |

Mandos: stick/cruceta para moverse, X = puño, A = patada, B/RT = guardia, LB/RB = esquivar. El mando 1 controla al jugador 1 y el mando 2 al jugador 2.

`Esc` pausa. `Enter` en el menú empieza una partida de 2 jugadores. También hay modo **1 jugador contra la CPU**, con tres niveles de dificultad (botón *CPU: Normal* del menú).

### Movimientos

- **Puño, Puño, Patada**: combo que termina en patada giratoria (derriba)
- **Puño, Patada**: patada alta
- **Adelante + Puño**: codazo (golpe medio)
- **Adelante + Patada**: patada de empuje, ideal para sacar al rival del ring
- **Abajo + Puño**: puño bajo
- **Abajo + Patada**: barrida (bajo, derriba)
- **Guardia + Puño** (de cerca): agarre que lanza al rival por detrás de ti
- **Guardia** justo al ser agarrado: escapar del agarre
- **Saltar + Patada**: patada en el aire

Los golpes **altos** se esquivan agachándose; los **medios** golpean a quien está agachado; los **bajos** solo se bloquean con guardia agachada. Si el rival sale del ring, ganas la ronda al instante.

## Ejecutar en local

Los módulos y la arena se cargan por HTTP, así que hay que servir la carpeta `docs/` (abrir el `index.html` con doble clic no funciona):

```bash
python -m http.server 8765 --directory docs
```

Y abrir http://localhost:8765

## Estructura

```
Arena_Pelea.blend      escena de Blender (fuente de la arena)
docs/                  juego web (publicado con GitHub Pages)
  index.html, style.css
  assets/arena.glb     arena exportada desde Blender
  assets/asientos.json posiciones del público (exportadas del objeto "Publico")
  src/main.js          bucle, rondas, cámara y HUD
  src/characters.js    plantilla de luchadores y construcción de sus modelos
  src/fighter.js       luchador: estados, física y golpes
  src/poses.js         poses y tabla de ataques (frames, daño, alcance)
  src/arena.js         carga de la arena, público, luces y partículas
  src/input.js         teclado, mandos y controles táctiles
  src/net.js           conexión online entre dos navegadores (PeerJS)
  src/ai.js            CPU
  src/audio.js         sonidos sintetizados
  src/music.js         reproductor de la música compuesta en Ableton
  assets/musica.json   notas de los 4 temas
tools/componer.py      composición de la música (genera musica.json)
```

Para cambiar la arena: edítala en Blender y vuelve a exportar `Arena_Ring`, `Arena_Entorno` y `Arena_Galeria` (sin el objeto `Publico`) a `docs/assets/arena.glb`.
