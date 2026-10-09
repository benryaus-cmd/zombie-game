DEAD CITY: gameplay tuning (10 October 2026)

Source: benryaus-cmd/zombie-game. Original graf-game left unchanged.

The HubSide navigation target is:
https://preview--55efd0b1-9368-4172-9456-53db458ef667.aippy.live

Updates:
* Zombies with one missing leg hop; with both legs removed they crawl. Detachment hides prepared limb meshes and matching footwear, with simple airborne impulses, gravity, bounces and an approximately two-second fade/cleanup.
* Kill scoring increases for consecutive kills inside the combo window. Headshots and dismemberment add bonuses. Occasional celebratory captions appear above the crosshair.
* Visual bullet trails reuse one dynamic line-geometry pool. Shots are still instantaneous ray hits for responsive mobile gameplay. Spread, tracer duration and brightness are adjustable.
* Switching the bottom-right weapon box works on pointer-down, including with a separate MOVE pointer already held.
* Pause menu > LIVE TEST VALUES / FPS shows editable settings. Each value has individual reset, plus full reset and a copyable JSON (including orientation, haptics and current FPS). Adjustments apply immediately. FPS runs at the top of all game overlays.
* Developer-only code is separated in tuning.ts, DebugPanel.tsx, DebugFPS.tsx and debug.css, with small integration points in ZombieGame.tsx.
* Tests run on Node 22 via scripts/test-zombie.mjs. Android haptics and Aippy multitouch still require device verification.

This update preserves portrait and landscape modes, original map rendering, existing player and zombie models, game portal, and original GitHub importer.
