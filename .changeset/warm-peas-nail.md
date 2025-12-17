---
'@mastra/playground-ui': patch
---

Fix agent default settings not being applied in playground

- Fix settings hook to properly merge agent default options with localStorage values
- Map `maxOutputTokens` (AI SDK v5) to `maxTokens` for UI compatibility
- Add `seed` parameter support to model settings
- Add frequency/presence penalty inputs with sliders
- Extract and apply agent's `defaultOptions.modelSettings` on load
