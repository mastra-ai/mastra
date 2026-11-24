---
'@mastra/playground-ui': minor
---

Added the `playground-ui/button-loading` lint rule to the oxlint plugin and its `recommended` preset. It reports a `Spinner` or spinning icon inside a button, and a label that changes with the button's own `loading`.

```tsx
// Reported
<Button loading={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>

// Use instead
<Button loading={save.isPending}>Save</Button>
```

`playground-ui/button-icon-prop` no longer tells you to move a loader to `icon`. The workflow buttons and `LogView.Refresh` now keep their label and show loading like every other button.
