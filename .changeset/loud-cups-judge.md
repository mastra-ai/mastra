---
'@mastra/playground-ui': minor
---

Added a multiple-selection mode to the Combobox component and removed the separate MultiCombobox export.

Use the shared Combobox API for both single and multiple selection:

```tsx
<Combobox multiple value={selectedValues} onValueChange={setSelectedValues} options={options} />
```

Storybook now includes examples for the single and multiple selection flows. Command item icons now render without an extra icon background.
