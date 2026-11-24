---
'@mastra/playground-ui': minor
---

Pages share one spacing rhythm. `PageLayout` puts 16px under the page header and 48px at the end of every scrolling page. Settings and form pages keep 24px above the title and 32px under it, and space their sections 24px apart (was 28px).

Text sits on whole-pixel lines on the 4px grid: 12px roles (`caption`, `eyebrow`, `column`) use a 16px line, 13px roles (`label`, `body-sm`, `card-title`) and 14px roles (`body`, `subheading`) a 20px line, `title` a 24px line, `display` a 28px line, and `display-lg` a 36px line.

Added the `playground-ui/no-page-spacing` lint rule to the `recommended` preset. It flags margins and padding on the elements a page hands to `PageLayout`, and section gaps other than 24px, so pages stop setting a spacing rhythm of their own:

```tsx
// Before
<PageLayout variant="page" header={header}>
  <div className="mt-6 flex flex-col gap-10 pb-16">{sections}</div>
</PageLayout>

// After
<PageLayout variant="page" header={header}>
  <div className="flex flex-col gap-6">{sections}</div>
</PageLayout>
```
