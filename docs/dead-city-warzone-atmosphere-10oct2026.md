# Dead City — Warzone atmosphere and inaccessible-spawn fix (10 October 2026)

Source revision: `93a6737212555ec7e6f9e79305f31499f6858038`.
The `graf-game` repository and its multiplayer server remain unchanged.

## Gameplay fix: inaccessible zombies
- `navigation.ts` now flood-fills collision-clear street cells reachable from the player using the current city collider set. A spawn candidate MUST be on that same connected area.
- `ZombieGame.tsx` also rejects placements within Quarter building footprints, beyond the playable quarter's ±68.5 m perimeter, on colliders, or too close to other zombies.
- The preferred spawn ring is 15–27m. If a walled courtyard has no far positions, fallback rings at 7–17m and 3–8m avoid a stuck wave.
- Navigation tests include a closed wall, an actual navigable gate, and the outer boundary.
- This fixes *new spawns*. The Aippy client must import and restart to clear any inaccessible zombies left from its previous runtime. Real-world-wall visual confirmation still requires Android testing.

## HUD and character
- Removed the visible FPS badge while retaining its live measurement DOM hidden for LIVE TEST VALUES JSON.
- Health bar now occupies the SAME grid row as wave/score rather than row 2. Minimap and radio moved upwards.
- `ArmedSurvivor` clones only lit character materials and uses roughness .97 and metalness 0 to reduce overly glossy highlights. Does not alter city/zombie shaders.
- Zombie-hit haptic pulse `[45,20,65]` ms with default .30s cooldown. Applies only to actual damage; respects HAPTICS OFF and safe developer mode.

## World atmosphere
- `src/zombie/WarzoneAtmosphere.ts`: self-contained Three.js effects system.
- Low-poly barrels, scorching, rust pieces and three animated flame cones at selected non-colliding quarter locations; bounded smoke Points buffer and warm shadowless point lights.
- Existing streetlight bulb emissive materials gain occasional irregular failures/flickers without rebuilding chunk meshes or enabling dynamic shadows.
- Occasional distant rooftop tracer streaks, with CC0 muffled explosions and brief visual flashes. Environmental gunfire cannot damage players or zombies.
- Web Audio low-frequency filtered wind loop and spatial fire crackles; 3 darker metallic CC0 award stingers replace the existing cheerful reward-playback mapping. Original reward assets still exist for rollback.
- Optional systems have tunables in `tuning.ts`: fire count, scale, warm light, smoke, flicker chance, ambient event frequency, rooftop tracer intensity, explosion flashes, sound levels, and hit haptics.
- Shared geometry, one bounded particle pool, no shadow casting, and proper material/audio disposal.
- Pooled rooftop traces are cosmetic and entirely separate from the actual combat tracer/hit system.

## Sound provenance
See `public/audio/sfx/SOURCES.md` for exact per-file upstream source and CC0 evidence.
5 new files in `public/audio/sfx`: three Kenney metal impacts, a Juhani Junkala explosion, and AntumDeluge-derived crackle.
Live Metal FM player and all original gun/zombie sound assets remain intact.

## Testing and expected checks
GitHub Actions compiles TypeScript, runs node regression tests and builds Vite. A green CI is NOT Android gameplay/performance validation.
After incremental Aippy import:
1. Start a new wave; walk along perimeter walls and verify no zombies appear on an inaccessible side. No infinite last-zombie count.
2. Confirm HP is near the top-left and the map sits just beneath; FPS badge no longer visible; LIVE TEST VALUES retains FPS in JSON.
3. Check damage haptics are strong (and OFF disables them), swipe/gun controls and radio remain intact.
4. Walk near fire props, check flickering bulbs, smoke, crackles, matte skin, and occasional rooftop combat.
5. Test low effect values and larger wave stress; compare Android frame-time stability, not just 120 FPS peak.
6. Confirm no environmental props block movement, zombie navigation or HubSide portal.
The environment is intentionally subtle by default; adjust via LIVE TEST VALUES and copy JSON.
