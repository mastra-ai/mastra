---
'@mastra/playground-ui': minor
---

Added `unavailableReason` to `ModelPicker`. When set, the picker shows its usual trigger, disabled, and hovering or focusing it shows the reason in a tooltip. Use it when the current user can see the model but is not allowed to change it.

```tsx
<ModelPicker
  providers={providers}
  value={value}
  onValueChange={setValue}
  unavailableReason="Only the session owner can change the model."
/>
```
