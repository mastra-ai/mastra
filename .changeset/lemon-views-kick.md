---
'@mastra/playground-ui': minor
---

Added `required` and `errorMsg` to `SettingsRow`. A required row shows the same asterisk as a form field label, and an error message appears under the label as an alert the control can reference.

```tsx
<SettingsRow label="Model" htmlFor="model" required errorMsg="Choose the model this agent runs on.">
  <Input id="model" error aria-describedby={fieldErrorId('model')} />
</SettingsRow>
```
