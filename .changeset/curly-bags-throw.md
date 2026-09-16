---
'@mastra/playground-ui': patch
---

Added `SidebarNew.Meter`, a sidebar footer card for a labelled figure such as a credit balance. It holds one height across states so a warning cannot shift the rows below it, and takes a `tone` of `neutral`, `warning`, or `danger` to tint a gradient wash across the card.

```tsx
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';

<SidebarNew.Footer>
  <SidebarNew.Meter
    label="Credits"
    value="$4"
    status="Credits are low"
    tone="warning"
    href="/organization/billing"
    linkLabel="Credit balance"
  />
</SidebarNew.Footer>
```

It reads `state` and `LinkComponent` from the provider like `NavLink` does, so a collapsed rail needs no extra props. The `action` slot renders outside the card link, which keeps a tooltip trigger from nesting a button inside an anchor.
