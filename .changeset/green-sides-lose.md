---
'@mastra/playground-ui': minor
---

Added `disabledTooltip` to `Button` and `DialogAction`. It explains why an action is unavailable and only shows while the button is disabled. A disabled button normally gets no hover or focus, so it never showed its tooltip; this one is reachable by mouse and keyboard.

```tsx
<DialogAction onConfirm={save} disabled={!name} disabledTooltip="Enter a name to continue">
  Save
</DialogAction>
```

`DialogAction` hides the explanation while the dialog is only pending, so it never shows a stale reason during a save.
