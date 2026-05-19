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

`tooltip` supports the same values as `tooltipContent`. Icon-only buttons that pass a string `tooltip` now also get it as their `aria-label` automatically, matching how labelled controls have always behaved. Pass an explicit `aria-label` to override.
