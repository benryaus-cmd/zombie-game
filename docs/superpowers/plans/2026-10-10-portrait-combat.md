# Dead City portrait and combat implementation plan

Goal: deliver the supplied development handover using the existing Three.js/React world.
Spec: owner's full handover in this session. Execution: inline, explicitly authorized to build, test, fix and publish.
Architecture: retain world movement/streaming and isolate zombie-specific rig, hit-region and debris helpers. Prepare detachable geometry from inspected skin weights, never collapse bones.
Constraints: only zombie-game; portrait default; landscape selectable; no backend or engine change; solo; exact-path incremental Aippy manifest and immutable asset fallback.

1. Controls/layout: add saved orientation choice, responsive HUD, renderer ResizeObserver; use existing rotated pointer conversion for forced landscape only; track fire/drag pointer ownership; clear inputs on pause/reset/blur. Tests: camera directions, rotated pointer positions, three-finger firing and releasing unrelated finger.
2. Models/rig: inspect actual glTF meshes, bones, clips and weapon dimensions. Import survivor and full-body zombie assets. Use packaged armed locomotion clips and weapon-specific calibrated hand socket/muzzle; animate upper-body aiming and recoil without overwriting locomotion legs. Tests: actual asset parse, grips/barrels and visual screenshots for all guns.
3. Combat: bone-position head/torso/arm/leg hit spheres, nearest pellet hits, camera AND muzzle wall occlusion; configurable damage/sever rules. Prepare split skin-weight geometry for head/arms/legs, freeze real vertices on detach, bounded gravity/bounce debris. Full-body AI with attack/death clips, wall LOS, valid spawns and obstacle corner routing; ribcage static scenery. Tests: hit regions, wall blocking, nearest target, detach geometry and cleanup, waves/reload/pause/restart.
4. Browser playtest: 390x844, 844x390, forced landscape on portrait, desktop; measure draw calls/memory/frame timings, play several waves, inspect screenshots. Build focused TypeScript and production Vite, full existing test suite; independent final review, fix findings.
5. Publish: commit runtime/assets first, generate pinned incremental manifest from changed runtime paths, validate each source and target and model embedded dependencies; publish to zombie-game. Report exact testing limits (no direct Aippy Android), screenshots and short import prompt.

Review focus: short Aippy viewport; simultaneous touch pointers; changed orientation during play; failed assets/unmount; weapon switching mid-reload and reset with held inputs.
