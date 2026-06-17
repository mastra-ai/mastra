---
"@mastra/core": patch
---

Move the Harness's selected-mode state onto the `Session` class, exposed as a `session.mode` namespace. `SessionMode` owns the currently-selected mode id (`session.mode.get()` / `session.mode.set()`) and the switch-concurrency guard (`session.mode.beginSwitch()` / `session.mode.isCurrentSwitch()`) that prevents a slower in-flight `switchMode` from being superseded by a newer one.

The Harness continues to own the mode *definitions* (`config.modes`) and the persistence/hydration of the selected mode (thread-setting `currentModeId`, per-mode model keys). No public Harness API changes — `getCurrentModeId()`, `getCurrentMode()`, `switchMode()`, and `switchModel()` behave exactly as before.
