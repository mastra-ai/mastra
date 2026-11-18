---
'@mastra/playground-ui': minor
---

Added `SettingsValue` for settings values people read but don't change or copy, such as a name, an email or a version. It shows the value in the normal text color on one line, truncates a long one with the full value on hover, and takes `mono` for versions and other identifiers.

```tsx
<SettingsItem title="Email" description="From your sign-in provider.">
  <SettingsValue>ada@example.com</SettingsValue>
</SettingsItem>
```
