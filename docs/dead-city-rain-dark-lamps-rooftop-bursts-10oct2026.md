# Dead City — night lighting, rain and distant battle diversity (10 Oct 2026)

Pinned runtime: `7d03a59f68a10e6cde97b1d18b9af653b28c1c09`
Manifest: `updates/dead-city-rain-dark-lamps-rooftop-bursts-10oct2026.json`
No server or HubSide changes.

## Original user feedback
- Remove the poor burning barrels entirely.
- Streetlights should sit near OFF by default and flicker ON dramatically, genuinely illuminating the moving player.
- A moving light sheen on the player's head while running should not happen continuously, but flashes from nearby real lamps should still appear.
- Rooftop gun emplacements should originate from many varied distant directions, always shooting *toward the city*, never uselessly away.
- Ordinary burst 4–9 shots. Sometimes two 3–5-shot bursts separated by about .5 seconds.
- Add progressively heavier rain with live performance controls.
- A draggable live-value UI above gameplay, collapsible to a small FPS button, easy to remove.
- Carry forward user-supplied tuning: warStreetFlicker=3, warExplosionLight=8, warTracerBrightness=1, warBattleInterval=5, distant gunfire=.95 and the other existing game values. New fire effects removed. Do not overwrite saved device preferences.

## Implementation
- `WarzoneAtmosphere.ts`: replaces the old fire/smoke/rubble geometry with ONLY rooftop-battle VFX and instanced-lamp callback. Sources now sample many positions in a ring around the player, optionally >200m via live controls, with endpoints clamped to ±53m inside the playable map and directed inward. Collision ray check still rejects obstructed paths. Two volley styles: single 4–9 shots or double 3–5 plus 3–5, configurable .5s gap; each group sticks to its same source and path, audio/muzzle/tracer are synchronised. No gameplay hit logic changes.
- `cityAtmosphere.ts`: adjusts Map2's existing instanced bulb, matching ground pool and real point-light intensity together. Independent probabilistic mostly-OFF cycles. Controls include OFF glow, probability, frequency, ON portion, peak brightness, lighting distance and warm/white colour. Preserves `settings.streetLights` OFF and global day/night settings.
- `ZombieGame.tsx`: disables the old player-following point light only for this Dead City world to stop the moving head highlight; the nearby street lamp point lights can still cast temporary bright light across the actual character. Verified compile; lighting effect needs Aippy visual check.
- `RainEffects.ts`: rain test pool independent of HubSide's built-in sky modes. One LineSegments draw call with up to 1,800 streaks; each frame updates only active drops. Rain levels are arbitrary (0 off, 120 light, ~500 heavy, ~1500 storm); tunable opacity, speed, length, horizontal wind, radius and brightness. Depth-tested, rain visible without scene fog. No extra textures.
- `DebugPanel.tsx`, `debug.css`: move window by dragging the title; MINIMISE collapses to the small always-visible FPS/control bar; EXPAND restores fields/JSON; CLOSE removes overlay. Independent self-contained UI; safeWhileTuning protection goes OFF when the panel is collapsed to resume normal fighting. All prior reset/copy/sound-preview functions retained. Source links in `ZombieGame.tsx` remain removable without touching gameplay.
- `audio.ts`: increase war-shot range cutoff to 260m to allow genuinely distant emplacements. Prior radio/weapon sounds untouched.

## Regression tests/QA
Automated:
- Node 22 TypeScript, gesture interaction checks, all zombie tests including new 4–9/3–5/3–5 distribution and inward battle direction cases, Vite production build.

Device-only checks after import:
1. Walk/run near actual streetlamps; verify lamps look OFF for most cycles, flash ON independently and briefly illuminate the survivor's head/ground. Confirm no permanent rolling sheen during running.
2. Tune OFF glow to zero, lamp brightness/radius up, then frequency/chance/duration to verify each works live. Check streetlights settings OFF disables them.
3. Wait 10+ seconds of random rooftop combat, confirm some origins are visually farther away but shots aim inward. Hear these at 150–200m if volume and network permit. Double bursts separated by the specified gap.
4. Check that no barrels or fire sprites appear at old locations.
5. Test rain counts 0, 120, 500, 1500, 1800 while moving/shooting. Record FPS and frame-time spikes, as the previous 120 FPS reading doesn't guarantee margin during heavy combat.
6. Open LIVE TEST VALUES, drag by header while playing, MINIMISE to FPS, move it, EXPAND again, edit values, COPY JSON and CLOSE. Test both orientations.
7. Confirm no Aippy importer rebuild, HubSide link changes, weapon control regressions or audio problems.

The previous user JSON remains in localStorage under `dead-city-debug-values-v1`. New settings use declared defaults. Existing local settings stay as chosen. Removed fire tuning keys are ignored on restore.
