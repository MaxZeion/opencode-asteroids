# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler. Incluye OVNI, power-ups, escudo, triple disparo, hiperespacio, high-score persistente y música chiptune sintetizada.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups, enemigo OVNI, estrella fugaz, skins personalizables, triple disparo, hiperespacio, high-score persistente y música chiptune sintetizada de fondo.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- **localStorage** — persistencia de skin y high-score (nombre + puntaje)
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción     |
| --------- | ---------- |
| `←` `→`   | Rotar nave |
| `↑`       | Propulsar  |
| `Espacio` | Disparar   |
| `Z`       | Triple shot (5 s, recarga 20 s) |
| `Shift`   | Hiperespacio (riesgo; cooldown 4 s) |
| `S`       | Cambiar skin de la nave          |
| `P`       | Pausa                           |
| `M`       | Silenciar audio                 |
| `H`       | Mostrar ayuda                   |

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |

| Enemigo | Puntos |
| ------- | ------ |
| OVNI    | 200    |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- **OVNI enemigo** que cruza la pantalla cada 8–14 s, dispara contra la nave y se destruye con un solo impacto (200 pts)
- **Power-up de velocidad** (drop de asteroides, ícono ⚡) que duplica la propulsión por 5 s
- **Power-up de escudo** (drop de asteroides, ícono cian): al recogerlo aparece una burbuja alrededor de la nave con 3 cargas. Cada impacto (proyectil del OVNI **o** asteroide) consume una carga y destruye el proyectil/asteroide. Sin cargas, el escudo desaparece
- **Habilidad de triple shot**: pulsa `Z` para disparar 3 balas en abanico durante 5 s (cooldown 20 s; la nave se tinta de cian mientras está activa)
- Estrella fugaz: asteroide dorado con estela, muy rápido, que desaparece en ~8s (150 pts, se parte como los demás)
- **Skins personalizables**: 5 diseños de nave (Clásica, Dardo, Delta, Flecha, Pixel). Pulsa `S` para ciclar; la elección persiste en `localStorage` y se muestra un toast con el nombre al cambiarla
- **Hiperespacio** (tecla `Shift`): teletransporta la nave a una posición aleatoria con 4 s de cooldown y 1.2 s de invencibilidad post-llegada. Riesgo: si el destino coincide con un asteroide o un OVNI, la nave muere
- **High-score persistente**: al perder todas las vidas, si superaste el récord anterior se piden 3 iniciales (flechas + Enter) y se guardan en `localStorage` junto al puntaje
- **Música chiptune sintetizada**: loop de fondo en Re menor (lead square con lowpass + bajo triangle), volumen bajo, se silencia con `M` y se pausa automáticamente al pausar el juego
- **Fondo de estrellas con paralaje** en 3 capas (170 estrellas en total); las cercanas se aceleran cuando la nave propulsa
- **Pausa, mute y auto-pausa**: `P` pausa todo (incluida la música); `M` silencia audio; al cambiar de pestaña el juego se pausa solo para que no consumas vidas mientras no estás mirando
