---
'@mastra/playground-ui': minor
---

Added SectionCard component to design system. Provides card primitive with tinted header strip (title, description, optional action slot), transparent body, and `default`/`danger` variants. Composes `CardHeading` for typography. Suitable for settings pages, dashboard sections, and grouped form layouts.

```tsx
import { SectionCard } from '@mastra/playground-ui';

<SectionCard title="Theme" description="Customize the appearance.">
  <ThemeSelector />
</SectionCard>;
```
