---
'@mastra/playground-ui': minor
'@internal/playground': patch
---

Removed `ButtonWithTooltip` from `@mastra/playground-ui`. Use `Button` with the `tooltip` prop instead.

**Migration**

```tsx
// before
import { ButtonWithTooltip } from '@mastra/playground-ui';

<ButtonWithTooltip tooltipContent="Search">
  <Search />
</ButtonWithTooltip>

// after
import { Button } from '@mastra/playground-ui';

<Button tooltip="Search">
  <Search />
</Button>
```

`tooltip` supports the same values as `tooltipContent`, and string tooltips continue to be used as the `aria-label` for icon-only buttons.
