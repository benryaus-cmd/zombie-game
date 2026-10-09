# Dead City portrait/combat validation — 10 October 2026

Implemented against starting commit `50cde3f4d8d2f0355f5d4ca481f9643fc113cd5d`, only in zombie-game.

## Result

Portrait is the initial preference; the main/pause menu exposes PORTRAIT and LANDSCAPE and saves the choice. Landscape rotates only when selected in a portrait container. The renderer follows its unrotated container dimensions through ResizeObserver. No native orientation lock or fullscreen requirement.

The original rotated zombie root lacked the `.game-portrait` ancestor the shared joysticks use for coordinate conversion. That class is now present only in the rotated presentation, and drag deltas follow the same conversion. Fire belongs to its own pointer; releasing another touch no longer stops it. Pause, reset and blur clear held inputs.

The default survivor uses the full `Characters_Matt.gltf` asset, because the single-weapon Matt export only includes Knife and WoodenBat_Saw, while the full export includes all three authored firearm sockets. Existing civilian models/catalog remain available. The whole survivor rig is mirrored to make the authored trigger hand the right hand. Actual Idle_Gun and Run_Gun clips supply locomotion/stance; the torso follows the reticle, the supporting arm uses a small two-bone adjustment for rifle/shotgun, and recoil/reload are procedural. There is no invented reload/shoot animation. Gun sizes, baked barrel directions and barrel endpoints were checked against actual pack vertices. The existing bunny companion is hidden in zombie mode so it does not cross the combat view.

Basic and Chubby are full-body attackers with actual Run_Arms, HitReact, Idle_Attack, Crawl and Death clips. Chubby appears from wave two. Zombie_Arm was inspected, but already lacks a limb, so it was not selected as the first full-body variation. Ribcage is now static scenery. Spawn attempts retain queued enemies if no valid position exists. Chasing routes around obstructing collider corners, and melee requires wall line of sight and reachable height.

## Dismemberment

`scripts/prepare-zombie-parts.py` partitions triangles offline using the real rig skin influences. Every original triangle appears once across head, torso, left/right arm and left/right leg meshes; animation/skeleton data is retained. Runtime bone-position spheres identify all six regions. A headshot removes the actual head geometry and kills. Close shotgun arm/leg hits remove the matching prepared region; leg loss uses Crawl while alive. A removed region is excluded from later pellets. Bodies use Death and remain for three simulation seconds.

Detachment freezes the selected region's skinned vertices at the current pose, hides that region and sends the real geometry away with gravity/bounce. Shared materials stay owned by the cached source. Debris is capped at 24 and removed after six simulation seconds. Matching mesh regions share one skeleton/bone texture per enemy. Damage, pellet/spread/range values and limb distance/damage/debris limits are in `src/zombie/combat.ts`.

## Verified

- Focused TypeScript check and production Vite build pass. Production excludes the development-only test access.
- `node scripts/test-zombie.mjs`: 11/11 focused tests pass.
- Chromium, 390×844: 23 deterministic browser engine checks pass, including real model/skeleton loading, head/arm/leg hits, exact reload transfer, both wall ray checks, building-corner navigation, three waves completed using assisted head aiming, death, pause and complete restart. Rendering is disabled during the accelerated simulation checks; normal rendering is used for screenshots and input tests.
- Actual CDP touch input: portrait 390×844, rotated landscape within 390×844, native landscape 844×390, short portrait 384×606. Move + look + fire together work. Releasing MOVE or LOOK preserves FIRE. Up/down/right look mappings, control bounds and saved orientation pass.
- Desktop 1280×720: keyboard movement/jump/weapon selection, mouse drag aiming/fire, keyboard reload pass. Measured gun barrel-to-target dot products exceed .999 for all three weapons.
- Production browser smoke test: start in portrait, pause, change to landscape, resume; no JavaScript exceptions.
- Independent code review: no actionable findings.

## Performance and limits

With 18 visible zombies, software Chromium recorded approximately 160 draw calls and 150,000 triangles. After repeated spawn/remove cycles, warmed cache counts returned to 81 geometries and 12 textures; active 18-enemy runs used 30 textures. Initial cache population increases counts and is not a leak. CPU/software-renderer timing is not an Android hardware benchmark; raw measurements are in performance-results.json.

The available browser environment could not load 11 pre-existing external HubSide scenery/texture/Aippy inspector URLs. New zombie/survivor assets loaded locally and all browser engine checks had zero JavaScript exceptions. Screenshots therefore show the existing world's simpler fallback geometry. No claim of Aippy Android, remote asset fallback, or full-quality-city hardware performance testing is made.

The inherited full suite has eight pre-existing failures (basketball authority, poster/image-loader mocks and old paused camera-distance expectation). Baseline: 460/468. Final: 471/479. All 11 added tests pass and the same eight inherited tests fail. The unrelated HubSide systems were not changed.

## Reproduce

Run `node scripts/test-zombie.mjs`, `node node_modules/typescript/bin/tsc -p tsconfig.zombie.json --noEmit`, and `node node_modules/vite/bin/vite.js build`.

Browser scripts under `scripts/zombie-qa/` start their own Vite server. Supply `PLAYWRIGHT_MODULE` if Playwright is installed outside the repo, `CHROMIUM_PATH` for an existing browser, and optionally `QA_OUTPUT` for results. Run integration.cjs, touch.cjs, desktop.cjs, performance.cjs or visuals.cjs individually from the repository root. They use development-only engine access, which is excluded from production. Screenshot fixtures arrange real enemy models inside the existing city to make the view repeatable.

## Asset source

Quaternius Zombie Apocalypse Kit: https://quaternius.com/packs/zombieapocalypsekit.html

Source mirror: agentkaerf/FreeModels, commit `db3df04d1e4714298a09510b26fb6de6645138a2`, `Zombie Apocalypse Kit - March 2024/Characters/glTF`. Embedded buffers/images require no sidecar downloads. Source Basic/Chubby exports are retained for rebuilding the prepared parts. Existing pack License.txt is retained.
