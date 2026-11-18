---
'@mastra/playground-ui': minor
---

Settings now show read-only values one way across apps: `CopyField` for values people copy (IDs, keys, URLs) and `SettingsValue` for values they only read (name, email, versions).

- `CopyField` (`@mastra/playground-ui/components/CopyField`): the field look with an inset copy button; long values are cut in the middle instead of clipped, and copying always copies the whole value. `CopyInput` is deprecated and now renders a `CopyField`.
- `SettingsValue` (`@mastra/playground-ui/new/settings`): plain muted text that truncates; `mono` for versions.

```tsx
<SettingsItem title="Organization ID" description="Useful when contacting support.">
  <CopyField value={organization.id} label="organization ID" />
</SettingsItem>
```
