# Dead City audio provenance (2026-10-10)

All actual playback files are stored under `public/audio/sfx/` and resolved as local Vite assets from `src/zombie/audio.ts`. No runtime remote-GitHub audio fetches.

## Gunshots: CC0 1.0

Eight edited, near-field gun reports copied unchanged from `yegors/hard-lines`, folder `public/audio/`.
- pistol-0/1/2.wav from p226-report-0/1/2.wav: Walther PPQ recorded near-field, three takes.
- rifle-0/1/2.wav from mp5-report-0/1/2.wav: Carl Gustav M45 automatic report, three takes (compact automatic gun sound, not claimed actual AR-15 recording).
- shotgun-0/1.wav from sg-report-0/1.wav: Benelli Nova 12 gauge.
The source project credits the CC0 **Free Firearm Sound Library**:
https://opengameart.org/content/the-free-firearm-sound-library
Source evidence: https://github.com/yegors/hard-lines/blob/main/public/audio/README.md

## Zombie groans: CC0 1.0

Eleven individual original WAV recordings by **artisticdude**, from the CC0 "Zombies Sound Pack":
https://opengameart.org/content/zombies-sound-pack
Mirrored as `audio/oga-zombies/zombies/zombie-N.wav` by:
https://github.com/Mcamento8/open-game-sfx-index
Files copied unchanged as `zombie-1.wav`, `zombie-3.wav` through `zombie-12.wav`.
Individual short groans play in different categories based on enemy event. They are reused with slight pitch variation; the underlying source pack does not contain explicitly labelled attack/reload effects.

## UI and effects: CC0 1.0

From Kenney assets included in the Mcamento8 CC0 index:
- `reload.ogg` = `interface-sounds/switch_001.ogg` (pistol mechanical cue).
- `reload-rifle.ogg` = `interface-sounds/switch_002.ogg` (rifle mechanical cue).
- `reload-shotgun.ogg` = `interface-sounds/switch_003.ogg` (shotgun mechanical cue).
  These are quick CC0 game UI/foley switch recordings, NOT actual firearm magazine recordings.
- `empty-click.ogg` = `interface-sounds/click_001.ogg`
- `bullet-impact-0.ogg` = `impact-sounds/impactMetal_light_000.ogg`
- `bullet-impact-1.ogg` = `impact-sounds/impactSoft_heavy_000.ogg`
The sources and licences are documented at:
https://github.com/Mcamento8/open-game-sfx-index/blob/main/ATTRIBUTION.md

## Deliberately excluded

The suggested `flareteam/flare-game` assets were not imported. That game's repository has CC BY-SA 3.0 (not blanket CC0), which does not satisfy the requested CC0-only policy. No unverified assets from the other suggestions were copied.

## Implementation

`src/zombie/audio.ts`: browser Web Audio mixer, decode/caching, unlock on START and resume, overlapping gun report AudioBufferSourceNodes, positional limited zombie voices, distance falloff, random takes/pitch, three buses, live settings in `src/zombie/tuning.ts`. Gun sounds always 2D and prominent. On mobile, vibration is independent of Web Audio support. Audio context and buffers are disposed on cleanup.

Short WAVs were retained at their original size/format for this first integration. They are browser-compatible but not yet re-encoded as OGG. If future transfer size or build size is a problem, batch convert these chosen clips to compressed OGG and update source URL table.

## Score multiplier cues (CC0)

Short, local event stingers copied from the `Mcamento8/open-game-sfx-index` CC0 archive:
- `combo-hit.ogg`: `audio/interface-sounds/confirmation_002.ogg` (Kenney interface cue)
- `combo-up.ogg`: `audio/digital-audio/powerUp3.ogg` (Kenney digital cue)
- `combo-big.ogg`: `audio/digital-audio/highUp.ogg` (Kenney digital cue)
https://github.com/Mcamento8/open-game-sfx-index/blob/main/ATTRIBUTION.md

These cues play only when a multi-kill pop-up occurs. They use the `comboVolume`
setting and have their own cooldown to avoid cluttering automatic gunfire.
