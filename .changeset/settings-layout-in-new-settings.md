---
'@mastra/playground-ui': minor
---

Moved `SettingsLayout` into the settings family, so a settings page is built from one import: `SettingsLayout` frames the page, `SettingsGroup` / `SettingsContainer` / `SettingsRow` fill it. The Storybook `New/Settings` page now shows the full page, not just the groups.

**Removed exports**

- `@mastra/playground-ui/components/SettingsLayout` is gone. Import it from `@mastra/playground-ui/new/settings` instead:

```tsx
// Before
import { SettingsLayout } from '@mastra/playground-ui/components/SettingsLayout';

// After
import { SettingsLayout } from '@mastra/playground-ui/new/settings';
```

- `Sections` (`@mastra/playground-ui/components/Sections`) is gone. It only stacked its children with a gap; use a plain element instead:

```tsx
// Before
<Sections>…</Sections>

// After
<div className="grid gap-6">…</div>
```
