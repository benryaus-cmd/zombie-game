# Dead City warzone correction (10 October 2026)

Reviewed Work report and evidence `Dead-City-Warzone-Evidence.zip`: actual Chromium render and audio diagnostics on revision `4768a60a184076a730aeb228044db310cb72f0a8`. This implementation is pinned to source commit `7bea4a157f3ecb8368c9a1a72422b7debb18e2b4`.

## Implemented

### West-wall zombie navigation
- `navigation.ts`: global world-aligned 1.15m A* grid with binary heap, collision-checked diagonal movement, full detour path and obstacle-sampled path simplification. No goal-direct fallback through collision.
- `ZombieGame.tsx`: retain and follow waypoints instead of rebuilding a moving origin-centred grid every ~1sec. Replan on world collider-count changes, meaningful player movement or progress failure. Preserve two route calculations/frame, enemy separation and server-free solo play.
- Regression: exact west-wall collider (-66..-42, -11.225..-10.775) and spawn (-51.848,-11.936) to player (-64,0), checking an unobstructed route to the player. Also verifies blocked detours.

### Distant battle effects
- `WarzoneAtmosphere.ts`: choose one collision-cleared rooftop trajectory per burst; fire 3–6 rounds from that origin; muzzle flare/sound originate at the same point; moving .22–.38s tracer heads with fading tails and scene-mesh depth occlusion. No fake stationary segments.
- Camera-facing pooled quad trails use an alpha gradient, `fog:false`, `depthTest:true`, `depthWrite:false`. Fog bypass does not make bullets visible through solid buildings. Environmental shots do not affect player/zombie hit logic.
- Explosion triggers when the last tracer reaches the destination, with a soft procedural flash and short shadowless light. Reset clears muzzle/explosion/tracer state. Disabling war events clears it immediately.
- Tests cover tracer travel and rays blocked by geometry.

### Audio
- `audio.ts`: background gunfire source gain raised to .4, sample pitch ~.91, war-shot spatial ref distance 24m / rolloff .35 and 150m explicit cull. Keep one gunfire sound for each rooftop muzzle flash.
- Existing `warAmbienceVolume` setting now labels *Distant gunfire volume* with default .65. Added separate `warExplosionVolume`; fire and wind already have separate controls. The ambient bus is no longer a hidden multiplier across unrelated volume controls.
- Frontload decoding of rifle/explosion/fire samples; don't repeat the entire preload schedule every resume.
- Pause gates warzone ambience; resume/start still use game gesture to unlock Web Audio. Metal FM radio remains separate and unchanged.
- LIVE TEST VALUES now previews WAR SHOT, WAR BOOM and FIRE alongside the existing sounds, and exposes the new volume values.

### Burning barrels and layering
- Open-sided rough low-poly metal barrel (10 sides), proper rim and glowing coal mouth; no closed cylinder lid or broad bright stripe layers.
- Jagged animated opaque, depth-writing flames replace nearly solid transparent cones. Radially masked ground glows, scorch marks, smoke and explosions replace square/blended tiles. Ground blood decals draw before transparent foreground effects, while solid barrel/flames remain depth-occluding.
- Existing CC0 assets and source licence records preserved. All new masks are generated locally with CanvasTexture; no external or binary assets added.

### Streetlights
- `cityAtmosphere.ts` now adds deterministic per-instance flicker to the existing Map2 instanced bulb, corresponding ground pool fade and the associated real point light. Uses the existing scene update callback; no new lamp geometry or reconfiguration of global city renderer. Streetlights OFF still works, strength=0 restores normal brightness.

## Validation
GitHub Actions: Node 22, TypeScript `tsconfig.zombie.json`, gesture checks, `scripts/test-zombie.mjs`, production Vite build. Tests include two new west-wall detour and environmental tracer cases. Automated green build proves correctness of compilation/regression tests, NOT final appearance or audio quality.

## Android QA required
1. West edge (-64,0) with zombie at (-51.848,-11.936); check route completion after city chunks finish loading. Check no waves strand zombies. Re-test crowded/rolling city chunks.
2. Camera near rooftop: visible moving tracers at 30/50/80m with fog high/low. Building roofs must hide streaks properly. Sounds and muzzle flashes must stay at one rooftop for a burst.
3. Metal FM ON at 30%, listen to gunfire/war explosions with live audio preview; adjust levels if they mask or cannot be heard on device.
4. Walk around fires and shoot zombies, check depth, flame/mouth geometry, smoke and explosions from several angles.
5. Map2 lamps visibly flicker, frequency 0 returns steady lamps, streetlight OFF works.
6. Pause/restart, live values copy, portrait/landscape, 10+ zombies and movement/jump stress. Check actual Android frame times and hardware resources. Previous Work's SwiftShader numbers are not Android FPS.

Incremental Aippy update: `updates/dead-city-warzone-review-fixes-10oct2026.json` (8 existing source files; no audio import).
