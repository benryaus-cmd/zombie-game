# Dead City — multitouch, portal radar and lighting inversion (10 Oct 2026)

Runtime code pinned to `f9cb3cc207e09f0ee57e15888379dcfac837e61a`.
Aippy incremental manifest: `updates/dead-city-multitouch-portal-light-invert-10oct2026.json` (10 runtime files).
No changes to HubSide, multiplayer server, underlying game map, radio streams, gameplay balance, inventory or saved preferences.

## Simultaneous touch controls
Android WebView may suppress click events while a different finger holds the joystick.
Dead City's real game buttons now act on their own pointerDown rather than
waiting for synthetic click: RELOAD, JUMP, WEAPON SWITCH, PAUSE, in-world
HUBSIDE portal link and METAL FM. Interactive tutorial NEXT/BACK/SKIP also act
independently of MOVE. Right-click is ignored. Keyboard Enter/Space activation
is retained with a click event detail=0 fallback. Each touch is handled once,
and existing MovementJoystick pointer capture and screen double-tap fire remain
unchanged. No global document-level touch listeners or gesture libraries.

## HubSide minimap marker
Real HubSide return portal world coordinates are provided by ZombieEngine's
radarSnapshot() (from existing `this.portal.position`). Radar draws a distinctly
blue-ringed `H` for an in-range portal and a blue bearing marker at the rim for
one outside its 32m default radius, preserving heading-up orientation and
existing yellow ammo, white health, green zombies and grey buildings.
The tutorial pickup legend also includes blue=HubSide.

## Streetlight inversion
Add `warLampInvert` to LIVE TEST VALUES > Lighting as an actual touch toggle,
default 0 (the original OFF-first behaviour). It is stored/exported with the
existing tuning settings, supports individual reset, and is changed without a
restart.

- OFF BY DEFAULT · FLICKER ON: lamps mostly emit `warLampIdle` (0.09 by the
  current owner default), randomly pulse up to `warLampPeak` (1.75).
- ON BY DEFAULT · FLICKER OFF: lamps mostly emit `warLampPeak`, randomly dim
  toward `warLampIdle`; the existing chance/rate/duration/brightness settings
  determine the interruptions. At strength=0, inversion chooses steady ON
  instead of steady OFF.

The same multiplier drives Map2 bulb instances, the projected light pools and
real point-light illumination on the player. Sky/day-night is unchanged. Main
streetlights OFF still disables them.

## Verification
GitHub Actions: Node 22, TypeScript, gesture tests, all zombie tests including
new inverted lamp pulse tests, Vite build: PASS.
New UI is not yet physically verified with two fingers on Aippy Android.

Required phone QA:
1. Hold left joystick forward; without releasing, tap RELOAD several times when
   ammo is missing; confirm moving remains uninterrupted.
2. While moving, switch weapons and press JUMP. Confirm neither action stops
   joystick movement or repeats unexpectedly.
3. Try PAUSE, METAL FM and tutorial NEXT/BACK while a finger holds MOVE.
4. With minimap heading-up, confirm blue H at portal (7,5), then walk beyond
   radar range and check blue bearing indicator rotates with facing direction.
5. Open LIVE TEST VALUES > Lighting. Compare both modes near a streetlight:
   OFF-first flashes ON; ON-first flickers OFF. Verify intensity on nearby
   player and ground, plus individual RESET and COPY SETTINGS JSON.
6. Test in portrait and landscape, and confirm normal start, shooting and
   double-tap/hold gestures still work.

Rollback: reimport the previous pinned manifest or replace only the 10 listed
files with their parent revision. No binary assets, protocol or storage
migration is involved.
