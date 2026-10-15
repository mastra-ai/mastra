---
'@mastra/playground-ui': minor
---

Added a `start` slot to `DialogFooter` for status text or a secondary control on the left, while the actions stay on the right. The footer still wraps on narrow screens.

```tsx
<DialogFooter start={<Button variant="ghost">Advanced options</Button>}>
  <DialogCancel>Cancel</DialogCancel>
  <DialogAction onConfirm={run}>Run</DialogAction>
</DialogFooter>
```
