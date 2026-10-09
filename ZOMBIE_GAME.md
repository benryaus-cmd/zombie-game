# Dead City / HubSide Zombie Survival

Standalone browser game forked from HubSide's original 3D world. The original HubSide source remains unchanged in benryaus-cmd/graf-game.

## What is playable

- Existing Map 2 city geometry, chunk streaming, fog, collision, animated character selection, keyboard and mobile movement.
- Third-person camera, aim/look joystick, pistol / rifle / shotgun, firing, magazine/reload, zombie HP/kill detection, and health.
- Repeated waves with chase AI, death animations, increasing speed/density and a game over/restart loop.
- A visible HubSide return portal near the spawn and a main-menu HubSide button.
- SOLO only. There is no connection to the HubSide multiplayer server and no interference with shared HubSide saves.

## Assets

Asset source: Quaternius Zombie Apocalypse Kit (March 2024)
https://quaternius.com/packs/zombieapocalypsekit.html
Original publisher's download:
https://drive.google.com/drive/folders/1mWP6sCHun7OUMHQeDNZLrXTteXlzWg_t?usp=sharing

The following self-contained glTF files were copied into public/assets/zombie-kit from the CC0 mirror https://github.com/agentkaerf/FreeModels (revision db3df04d1e4714298a09510b26fb6de6645138a2):
- Zombie_Ribcage.gltf (animated)
- Pistol.gltf
- Rifle.gltf
- Shotgun.gltf
- License.txt

The pack offers more zombie types, dogs and props. They have NOT been copied yet; adding the four other enemy visual variants can follow after gameplay is tested. The locally included files are real glTF meshes with embedded binary image/buffer data, not placeholders.

## Controls

Mobile: left joystick move, right joystick look, FIRE (hold), JUMP, RELOAD and select weapons.
Desktop: WASD / arrows move, click/hold to fire, SPACE jump, R reload, 1/2/3 change weapon.
Supports fullscreen/landscape attempts when available; CSS rotates the game on portrait screens when native landscape is unavailable.

## Develop

Node 22 or newer; pnpm 10.10.0; pnpm install; pnpm dev; pnpm build.
Entry: src/main.tsx -> src/zombie/ZombieGame.tsx.
Old HubSide modules are retained in this repository for selective reuse / rollback, but the new entry deliberately does not mount HubSide's painting UI or live multiplayer system.

This is an early gameplay pass, not tuned for dense hordes or fully tested on Aippy Android. Improvements include zombie obstacle navigation, visible weapon rig alignment, death motion, effects/audio and waves tuned against device performance.

## Aippy imports

The new `src/App.tsx` is the ZombieGame entry, so both a standalone Vite build and an Aippy imported-game adapter that mounts upstream App display the zombie UI. glTF requests prefer local `public/assets/zombie-kit`; when imported into a host without those public files, they fall back to the immutable GitHub asset URLs pinned to commit 8b033b0. Keep HubSide's original repository and original game URL separate.
