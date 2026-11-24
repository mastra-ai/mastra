---
'@mastra/playground-ui': minor
---

Added `CopyField` (`@mastra/playground-ui/components/CopyField`) for read-only values people copy, such as IDs, keys and URLs. It has the field look with an inset copy button, and long values are cut in the middle instead of clipped. The Copy button copies the whole value, and so does copying a selection inside a shortened value.

`CopyInput` is deprecated and now renders a `CopyField`, which takes only `value`, `label` and `className`: drop `disabled` and other input props, and switch the import.

```tsx
<SettingsItem title="Organization ID" description="Useful when contacting support.">
  <CopyField value={organization.id} label="organization ID" />
</SettingsItem>
```

```tsx
// Before
const before = <CopyInput value={id} label="project ID" disabled={!canView} />;
// After: there's no disabled state, so render the field only when the value can be copied
const after = canView ? <CopyField value={id} label="project ID" /> : null;
```
