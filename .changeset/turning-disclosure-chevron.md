---
'@mastra/playground-ui': minor
'mastra': patch
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

`CollapsibleTrigger` no longer rotates icons placed directly inside it. Use `DisclosureChevron` for the chevron, so other icons in the trigger stay still.

Chevrons across Studio and Factory now turn the same way when a section opens. Downward chevrons, such as the ones in Factory's knowledge panel, flip to point up instead of turning sideways.
