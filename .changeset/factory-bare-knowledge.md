---
'@mastra/factory': minor
---

`knowledge` now also accepts a `Knowledge` instance directly (`knowledge: new PlatformKnowledge()`), registered under its `id`. The `{ key, instance }` form still works and registers under `key`. The Knowledge page now reads with the same scopes as the project's sessions.
