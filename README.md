# Claude Street

Juego de pelea 3D para **dos jugadores en el mismo teclado** (o con mandos), al estilo de los clásicos de ring cuadrado: combates a 2 rondas, golpes altos/medios/bajos, esquivas laterales, agarres y **ring out**.

La arena (ring, estanque, antorchas, gradas y público) está modelada en Blender (`Arena_Pelea.blend`) y exportada a glTF. El juego corre en el navegador con [Three.js](https://threejs.org/), sin instalar nada.

**Jugar:** https://simonrovi-web.github.io/claude-street/

## Controles

| Acción | Jugador 1 (Kaito) | Jugador 2 (Rina) |
|---|---|---|
| Moverse | `A` `D` | `←` `→` |
| Saltar / agacharse | `W` `S` | `↑` `↓` |
| Esquivar (fondo / frente) | `Q` `E` | `I` `O` (o `Num4` `Num5`) |
| Puño | `F` | `K` (o `Num1`) |
| Patada | `G` | `L` (o `Num2`) |
| Guardia | `H` | `Ñ` (o `Num3`) |

Mandos: stick/cruceta para moverse, X = puño, A = patada, B/RT = guardia, LB/RB = esquivar. El mando 1 controla al jugador 1 y el mando 2 al jugador 2.

`Esc` pausa. `Enter` en el menú empieza una partida de 2 jugadores. También hay modo **1 jugador contra la CPU**.

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
  src/fighter.js       luchador: modelo, estados, física y golpes
  src/poses.js         poses y tabla de ataques (frames, daño, alcance)
  src/arena.js         carga de la arena, público, luces y partículas
  src/input.js         teclado y mandos
  src/ai.js            CPU
  src/audio.js         sonidos sintetizados
```

Para cambiar la arena: edítala en Blender y vuelve a exportar `Arena_Ring`, `Arena_Entorno` y `Arena_Galeria` (sin el objeto `Publico`) a `docs/assets/arena.glb`.
