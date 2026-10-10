# Dead City: Navigation, MetalFM, supplies and radar (10 October 2026)

## What changed
- `navigation.ts`: local bounded street search plus physical separation for nearby enemies. A small global route-computation budget and staggered repaths avoid CPU spikes with dense waves. Spawn positions also respect nearby living zombies.
- `ZombieGame.tsx`: keeps a minimum distance between zombies in attack range; never creates a clump of overlapping bodies if the player stands still.
- `ZombieGame.tsx`: throttles the inherited `updateChunks` call to meaningful motion or time instead of every rendered frame. This and cached droplet floor heights target jump/scene stutter. Exact Android frame-time results still require a device run.
- `MetalRadio.tsx`: live MetalFM streaming URL `https://channels.fluxfm.de/metal-fm/externalembedflxhp/stream.mp3`, previously used for HubSide. Initial state ON, volume 30%, starts only after the user's START click (browser audio policy). Click the small METAL FM button to pause gameplay and open ON/OFF/volume; back resumes gameplay. User choice stored locally. If a WebView blocks the external stream, the control shows an error and retry button. No audio files are redistributed.
- `Pickups.ts`: low starting total rounds (rifle 18, shotgun 6), auto-collect ammo/health pickups placed on clear ground, glowing crates, supply replenishment, faint pulsing line to nearest. Respawn items slowly within vicinity. Pickups use shared materials and free temporary geometry.
- `Radar.tsx`: noninteractive, heading-up compass-free radar with the player fixed in the centre (yellow triangle), nearby zombies green circles, pickups yellow squares, buildings grey shapes. 8Hz 2D canvas update instead of React state churn.
- Settings: editable `zombieSpacing`, `navInterval`, `radarRange`, `pickupCap`, `pickupGuideOpacity`, `rifleStartingRounds`, `shotgunStartingRounds`. Existing live JSON and individual reset controls work.

## Tests and remaining checks
Node 22 / TypeScript / Vite CI and `tests/zombie-navigation.test.ts` validate route selection, obstacle avoidance, crowd spacing and recovery from overlapping positions. This does not establish the actual visual appearance in Aippy Android.

Test the following on the Android app after incremental import:
- Stuck zombie behind a corner eventually routes around it; 10+ zombies should not stand inside one another.
- Jump while walking during a large wave. Compare observed FPS/dropped frames before/after. World draw distance must still feel right.
- Start MetalFM from START, open its radio button while waves approach, game pauses, ON/OFF and volume slider work, then the game resumes. Note that external streams depend on Android WebView permissions and network.
- Rifle starts 18 total rounds, shotgun 6 total. Move onto a crate to collect automatically. Check the line points at the nearest pickup.
- Radar always points forward, even after rotating 180°, and updates when zombies/pickups move.
- Original HubSide URL, portal, portrait/landscape, combat and dev tools unchanged.

## Aippy
Use `updates/dead-city-navigation-radio-supplies-radar-10oct2026.json` to import 8 source/runtime files only; preserve existing Node22 manifest downloader, aliases and Aippy wrapper. Do not full-reimport.
