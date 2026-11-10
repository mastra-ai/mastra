---
'@mastra/playground-ui': minor
---

Replaced `ThinkingLevelBars` with `ThinkingLevelIcon`, a single brain filled to the picked level that matches the brains in `ThinkingLevelRamp`. It turns amber for costly levels, stays empty while no level is set, and pulses with `loading`. `ThinkingLevelPicker` and `ThinkingLevelUnavailable` now show it on their button.

```tsx
// Before
<ThinkingLevelBars options={options} value={level} loading={loading} />

// After
<ThinkingLevelIcon options={options} value={level} loading={loading} />
```
