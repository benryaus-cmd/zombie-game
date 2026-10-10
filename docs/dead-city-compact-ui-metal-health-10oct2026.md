# Dead City compact HUD + MetalFM + health supplies (10 Oct 2026)

Main game: `src/zombie/ZombieGame.tsx`.

## UI changes
- The normal gameplay HUD no longer displays the large DEAD CITY / HUBSIDE SURVIVAL banner; the main menu retains its title.
- HP remains visible with a thinner, narrower bar in the uppermost HUD, leaving the left side free for the minimap.
- The heading-up radar is smaller and moved higher; the compact METAL radio button sits BESIDE, not below, the radar.
- The bottom-right weapon/ammo box has been reduced in width and height, with a smaller gun label and no redundant "TAP TO SWITCH" label. Reload remains independent.
- Applies to portrait and landscape using container queries. Existing visual screenshot dimensions should be confirmed in Aippy Android after import.

## Medical supplies
- World-space health pickups are now white packages bearing a red medical cross. All non-health ammo boxes remain yellow/orange.
- The radar draws health pickups as white square markers with a red cross. Ammo is yellow, zombies green, player yellow, buildings grey.
- Collection still grants +25 HP up to 100, unchanged.

## MetalFM regression fix
- Replaced Dead City's bespoke JSX `<audio>` player with HubSide's **existing and previously working** `LiveRadioController` from `src/game/liveRadio.ts`, and station selection in `src/config/radio.ts`.
- Important difference: HubSide builds the stream URL dynamically and creates `new Audio(url)` only when requested. HubSide specifically does this to avoid the Aippy static asset scanner treating radio streams as importable static assets.
- Retained the same known Metal station. Reuses one audio element, plays in response to START/ON gestures, and exposes buffering/errors and retry properly.
- Default 30% volume, ON preference, pause gameplay while configuring. Persisted ON/OFF and volume settings remain.
- This code targets the known Aippy problem but is **not yet proven on the target Aippy Android WebView** until user imports and tests.

## Rollback/import
Changes are isolated to five Dead City files. Aippy manifest also lists the two unchanged HubSide radio modules to guarantee they exist under the exact import paths.
`updates/dead-city-compact-ui-metal-health-10oct2026.json` (7 listed files). Do not change host shell/importer/world/server.
