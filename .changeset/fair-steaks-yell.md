---
'@mastra/code-sdk': minor
---

Replaced the quiet mode settings with a single `previewLines` preference, since compact rendering is now the only Mastra Code display mode.

`GlobalSettings` no longer has `preferences.quietMode`, `preferences.quietModeMaxToolPreviewLines` or `onboarding.quietModePreferenceSelected`. It adds `preferences.previewLines` (0–8, default 2). When settings load and `previewLines` isn't set yet, it is filled in from `quietModeMaxToolPreviewLines` and saved. The legacy keys stay in the file unchanged.

```ts
// Before
const lines = settings.preferences.quietModeMaxToolPreviewLines;

// After
const lines = settings.preferences.previewLines;
```
