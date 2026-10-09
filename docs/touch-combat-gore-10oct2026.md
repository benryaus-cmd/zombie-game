# Dead City: Touch Combat & Gore Update (10 October 2026)

The existing HubSide city, portrait-default/landscape-option, survivor rig, full-body zombies,
wave rules, ammo and return portal remain intact.

## New touch gesture
- Swipe any empty game-world area to turn/aim.
- On touchscreens, tap empty world space once, release, then tap the same region again
  within 350 ms to fire. Hold the second touch to keep firing at the weapon's normal rate.
  You may still drag/aim while holding that second touch.
- Swipes, UI buttons, the move joystick and the weapon box do not count as the first tap.
- Releasing the firing touch, pointer cancellation, loss of capture or blur stops automatic fire.
- Desktop left-mouse click/hold remains a separate convenience control.

## HUD
- FIRE and LOOK joystick are removed. Keep the left MOVE joystick, JUMP, RELOAD.
- Bottom-right weapon box displays current weapon and ammunition; tapping cycles pistol/rifle/shotgun.
- HAPTICS ON/OFF setting in the pause/main menu, enabled by default, stored device-locally.
- Short navigator.vibrate() pulse only when a live round is fired; gracefully ignored if unsupported.

## Weapon feel / gore
- Per-weapon shoulder recoil, muzzle flash kick, subtle positional camera shake.
- Pooled bright blood mist particles and pooled ground stains from hits.
- Larger bursts from fatal shots and limb severing; red vignette for player damage.
- The existing true skinned-mesh dismemberment in bodyParts.ts is preserved.
- GPU buffers and instances are bounded; stains expire, blood particles fall, and all resources dispose/reset.

Tested by Node 22 TypeScript + Vite production build and gesture assertions through GitHub Actions.
This is NOT an assertion of having run inside Aippy Android; verify the real-device touch feel,
haptics permission/support, frame rate, and blood visibility after importing.

Changes stay entirely in zombie-game. No server, HubSide or Aippy host-shell changes.
