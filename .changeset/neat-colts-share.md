---
'@mastra/playground-ui': minor
---

Thinking level controls now keep their size while the level loads or can't be picked, so a model picker that holds them no longer jumps.

- `ThinkingLevelRamp`: `value` can be `undefined`, which shows empty bars and disables the slider. Pass `loading` to pulse the bars while the level loads, `unavailableReason` to say why no level can be picked, and `reset` for a text button in the header that returns to an inherited level.
- `ThinkingLevelBars`: always the same width, whatever number of levels the model offers; the bars widen to fill it. Pass `loading` to pulse the empty bars.

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
