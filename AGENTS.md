# AGENTS.md

## What this is

Zero-dependency Asteroids clone. Two files matter:

- `index.html` — entry point, just mounts a canvas and loads `game.js`
- `game.js` — a single ES6+ file containing all game logic, state machine, and rendering

There is no `package.json`, no build step, no bundler, no test suite, no lint config, and no CI. Do not add infrastructure without being asked.

## Running

- Open `index.html` directly in a browser, or serve locally with `npx serve .` → http://localhost:3000
- There is nothing to install, build, or test.

## Conventions

- Everything lives in one file (`game.js`); keep it that way. No new modules, no frameworks, no external libraries.
- Codebase and README are in Spanish; match that language in any new comments or docs you add.
- El canvas ocupa todo el viewport (`index.html` y `game.js`): `W` y `H` se recalculan en cada `resize` para aprovechar el máximo espacio posible. El juego asume tamaño arbitrario y sigue funcionando con cualquier proporción.
- Space wraps at edges (toroidal topology) — preserve this when touching movement/collision code.
- Scoring (do not change casually): large = 20, medium = 50, small = 100.
