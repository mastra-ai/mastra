---
'@mastra/playground-ui': minor
---

Thinking level controls now keep their size while the level loads or can't be picked, so a model picker that holds them no longer jumps.

- `ThinkingLevelRamp`: `value` can be `undefined`, which shows the row with no pill and disables it. The `label` now sits under the row as a muted caption, without an icon. Pass `loading` to pulse the row while the level loads, `unavailableReason` to say beside the label why no level can be picked, and `reset` for a text button at the end of the label row that returns to an inherited level. The ramp is now a row of brain icons that fill up with each level. A raised pill sits on the picked level and widens to show its name (amber for costly levels). Picking another level stretches the pill toward it, leading edge first. Click a level to pick it, or drag across the row: the level is saved once, when you let go. Hovering a level with a mouse leans the pill toward it. The control stays a slider for keyboards and screen readers.
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
