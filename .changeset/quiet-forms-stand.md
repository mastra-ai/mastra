---
'@mastra/playground-ui': minor
---

Added `FormLayout`, the page frame for create and edit form pages. It shows a back link and the page title above a centered 640px column, lined up with each section title, with no breadcrumb bar.

```tsx
import { FormLayout } from '@mastra/playground-ui/components/FormLayout';

<FormLayout backHref="/alerts" backLabel="Alerts" title="New alert" LinkComponent={Link}>
  <SettingsGroup>…</SettingsGroup>
</FormLayout>;
```
