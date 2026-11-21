# RIVER STRIKE — AKUMU GAMES

Shooter vertical de río, homenaje a River Raid, con sprites estilo FAMICOM y
música chiptune sintetizada en tiempo real (cero assets de audio).
Empaquetado como app nativa con **Tauri v2** (WebView del sistema + Rust).

## Descargar

- **macOS (Apple Silicon / M1, M2, M3, M4)** → `River Strike_1.0.0_aarch64.dmg`
  en [Releases](../../releases/latest).
- **Cualquier navegador** → `dist/river-strike.html` (un solo archivo, sin
  servidor ni instalación: doble clic y juega). Regenerar con `npm run html`.
- Linux: `npm run build:linux` compila el binario nativo.
- Windows: `npm run build` en Windows.

### Instalar en macOS

1. Abre el `.dmg` y arrastra **River Strike** a *Aplicaciones*.
2. La primera vez: **clic derecho → Abrir** (la app no está notarizada por Apple).
   Si aún así no abre:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/River Strike.app"
   ```

## Controles

| Tecla | Acción |
|---|---|
| ← → / A D | girar |
| ↑ ↓ / W S | acelerar / frenar |
| ESPACIO | disparar (se calienta el cañón) |
| P / ESC | pausa |
| M | sonido |
| F | pantalla completa |

Ratón/trackpad: mantén pulsado para mover y disparar.

## Cómo se juega

- Vuelas sobre los **bidones verdes** para reabastecer combustible.
- Dispara a los **puentes** para pasar de sector: +500 × combo.
- Cada enemigo destruido sube el **combo** (x2, x3… hasta x8) y multiplica todo.
  Si dejas pasar 3 segundos sin matar, el combo se cae.
- Volar pegado a la orilla da puntos extra de **riesgo**.
- Cada ascenso de rango da una vida extra.

## Desarrollo

```bash
npm install
npm run dev          # Tauri en modo desarrollo
npm run build        # bundle nativo
npm run build:mac-arm  # DMG para Apple Silicon (requiere macOS)
npm run sim          # simulación headless de la lógica (Node, sin DOM real)
```

## Estructura

```
src/                juego (HTML + Canvas 2D, sin frameworks)
  js/00-core.js     constantes, guardado, tipografía pixel 5x7
  js/10-audio.js    motor chiptune (osciladores + ruido)
  js/20-sprites.js  sprites pixel-art generados en runtime
  js/30-world.js    terreno procedural, entidades, partículas
  js/40-update.js   lógica de juego
  js/50-render.js   render del mundo y HUD
  js/60-screens.js  splash arcade, título, game over, pausa
  js/70-main.js     entrada y bucle principal
src-tauri/          shell nativa (Rust) + configuración de bundle
test/sim.cjs        simulador headless con bot para balance y regresiones
```

## Rendimiento

- Canvas 2D a 540×800 lógicos, `devicePixelRatio` limitado a 2.
- Sprites y textos pixel pre-renderizados en caché (una sola vez).
- Sin asignaciones por frame en los bucles calientes; pool de partículas acotado.
- 60 fps estables en un MacBook Air M1 (y ~16.7 ms/frame incluso en WebView
  con render por software).

© 2026 AKUMU GAMES
