---
'@mastra/playground-ui': minor
---

Settings now show read-only values one way across apps: `CopyField` for values people copy (IDs, keys, URLs) and `SettingsValue` for values they only read (name, email, versions).

- `CopyField` (`@mastra/playground-ui/components/CopyField`): the field look with an inset copy button; long values are cut in the middle instead of clipped. The Copy button copies the whole value, and so does copying a selection inside a shortened value. `CopyInput` is deprecated and now renders a `CopyField`, which takes only `value`, `label` and `className`: drop `disabled` and other input props, and switch the import.
- `SettingsValue` (`@mastra/playground-ui/new/settings`): plain muted text that truncates; `mono` for versions.

```tsx
<SettingsItem title="Organization ID" description="Useful when contacting support.">
  <CopyField value={organization.id} label="organization ID" />
</SettingsItem>
```

```tsx
// Before
<CopyInput value={id} label="project ID" disabled={!canView} />;
// After: there's no disabled state; don't render the value when it can't be copied
{
  canView && <CopyField value={id} label="project ID" />;
}
```
