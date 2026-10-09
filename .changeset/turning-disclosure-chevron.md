---
'@mastra/playground-ui': minor
---

Added `DisclosureChevron`, the chevron for a trigger that opens something: a menu, select, collapsible section or "show more". It turns while the trigger is open, read from the trigger's `aria-expanded`, so it needs no open state of its own:

```tsx
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';

<DropdownMenu.Trigger render={<Button />}>
  Options
  <DisclosureChevron />
</DropdownMenu.Trigger>;
```

`direction` sets where it points while closed: `down` (default) and `up` flip 180°, `right` turns 90°. Pass `open` to drive it from your own state instead.
