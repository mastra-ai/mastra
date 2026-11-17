---
'@mastra/factory': minor
---

**Breaking:** `knowledge` now takes a `Knowledge` instance directly (`knowledge: new PlatformKnowledge()`) instead of `{ key, instance }`; Factory registers it under its `id`, and the Knowledge page reads with the same scopes as the project's sessions.
