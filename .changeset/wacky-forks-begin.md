---
'@mastra/playground-ui': minor
---

Added `ThinkingLevelUnavailable`, the disabled thinking trigger with a tooltip, for when no level can be picked yet, for example while the level loads.

```tsx
<ThinkingLevelUnavailable options={options} label="Thinking" reason="The thinking level isn't loaded yet." />
```

Added `origin` and `footer` to `ThinkingLevelPicker`. `origin` says where the shown level comes from and is read with it on the trigger; `footer` sits at the bottom of the popover, for example to offer a way back to an inherited level.

```tsx
<ThinkingLevelPicker
  options={options}
  value={level}
  label="Thinking"
  origin="build mode default"
  footer={<Button onClick={useDefault}>Use default</Button>}
  onChange={setLevel}
/>
```

Fixed the first segment of a `ButtonsGroup` losing its rounded leading corner and border while its `Popover` is open.
