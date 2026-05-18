---
'@mastra/playground-ui': major
'@internal/playground': patch
---

Removed the `ButtonWithTooltip` component. `Button` already accepts a `tooltip` prop that wraps the rendered button in the design-system tooltip primitives, so the dedicated wrapper is redundant.

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

The `tooltip` prop accepts the same `ReactNode` value that `tooltipContent` did, and `Button` reuses a string `tooltip` as the `aria-label` for icon-only buttons.
