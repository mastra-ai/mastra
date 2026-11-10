---
'@mastra/playground-ui': minor
---

Redesigned `ThinkingLevelRamp` and made the thinking level controls keep their size while the level loads or can't be picked, so a model picker that holds them no longer jumps.

- `ThinkingLevelRamp` is now a row of brain icons that fill up with each level. A raised pill sits on the picked level and shows its name (amber for costly levels). Click a level to pick it, or drag across the row and the level is saved once you let go. It stays a slider for keyboards and screen readers.
- `ThinkingLevelRamp` accepts `value={undefined}` to show a disabled row with no pill. Pass `loading` to pulse it while the level loads, `unavailableReason` to say why no level can be picked, and `reset` for a text button that returns to an inherited level.
- `ThinkingLevelBars` keeps the same width whatever number of levels the model offers. Pass `loading` to pulse the empty bars.

```tsx
<ThinkingLevelRamp options={options} value={undefined} label="Thinking" loading onChange={setLevel} />

<ThinkingLevelRamp
  options={options}
  value={level}
  label="Thinking"
  reset={{ label: 'Use default', onClick: useDefault }}
  onChange={setLevel}
/>
```
