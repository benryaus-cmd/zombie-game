# Dead City interactive in-world tutorial (10 October 2026)

Runtime source pinned to `82e075714329b376b82ba51c5e266d9e42813aec`.
Aippy manifest: `updates/dead-city-interactive-tutorial-10oct2026.json`, **5 files**.

## User experience
The existing game menu (first launch, pause menu and game over) includes
**HOW TO PLAY · INTERACTIVE TUTORIAL**. Clicking it loads a fresh real
Dead City session at wave zero, with zombies held off temporarily so the
player can learn controls safely in the actual city. Metal FM, movement,
weapons, pickup assets, radar, scenery, weather and other gameplay remain
real and functional. The guide does not create fake buttons or a separate
training scene.

Eight stages:
1. Move at least 2m using the left joystick / WASD.
2. Swipe open world space at least 65 pixels to look around.
3. Jump / Space.
4. Double tap open space and hold the second tap long enough to fire 2 real
   rounds. Desktop click/hold also works.
5. Tap the bottom-right weapon box to cycle weapons.
6. Tap RELOAD after using ammo (or after selecting the partially loaded rifle).
7. Walk onto a real existing ammo/health supply pickup (optional; can skip).
8. Read the survival advice and press START WAVES.

Current action progress is shown as GOT IT. NEXT advances, BACK revisits
a lesson, SKIP STEP allows inaccessible pickup/controls to be bypassed,
and SKIP TUTORIAL immediately begins normal wave scheduling.

The lesson card is compact at the upper middle of portrait play and
upper right on landscape to keep movement, jump, shoot swipe, weapon and
reload usable. Highlights point at the real relevant controls. It is
hidden during pause/radio settings and resumes with the same step.

## Implementation
- `src/zombie/tutorial.ts` contains typed steps and a pure progress predicate.
- `src/zombie/TutorialOverlay.tsx`, `tutorial.css` are isolated guide UI.
- `ZombieGame.tsx` exposes read-only movement/action counters and a
  tutorial-mode flag. During training, the normal wave countdown and spawns
  are paused; the engine otherwise updates as usual. Completion or skipping
  resumes normal survival with the existing startup countdown.
- Starting another tutorial restarts the game. Ordinary RESTART returns to
  the standard survival game. Nothing is saved as an account/profile.
- Only these 5 files need importing to Aippy. No new assets, network
  protocol changes, radio changes, outside-wall navigation changes, or
  dependency changes.

## Automated validation and Android checks
GitHub CI compiles TypeScript, runs existing tests plus
`tests/zombie-tutorial.test.ts` and builds Vite.
The tests cover every instruction, real-action thresholds, and trigger
separation, but **Aippy Android interaction still needs a device check**.

Suggested quick QA:
- Start tutorial while idle, pause/resume mid lesson, change orientation.
- Complete steps with real input: joystick, look swipe, JUMP, DOUBLE TAP +
  HOLD, cycle weapon, RELOAD, pickup crate.
- Confirm no waves spawn before END/SKIP, then waves spawn normally.
- Ensure buttons remain tappable while another finger holds the joystick.
- Back, SKIP STEP, SKIP TUTORIAL and RESTART all work.
- Verify normal START SURVIVING and existing saves/settings/Metal FM still
  work unchanged.
