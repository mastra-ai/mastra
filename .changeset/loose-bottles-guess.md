---
'@mastra/playground-ui': minor
---

Added `SegmentedControl`, a pill-shaped control for picking one of a few options. The selected option is marked by a thumb that slides between segments. It supports text, icon and text, or icon-only segments, the `sm`/`md`/`lg` control sizes, and disabled options with an optional tooltip.

```tsx
import { SegmentedControl } from '@mastra/playground-ui/components/SegmentedControl';

<SegmentedControl
  aria-label="Permission"
  value={policy}
  onValueChange={setPolicy}
  options={[
    { value: 'allow', label: 'Allow' },
    { value: 'ask', label: 'Ask' },
    { value: 'deny', label: 'Deny' },
  ]}
/>;
```

`ThemeToggle` is now built on `SegmentedControl`, so both look the same. It uses the shared control sizes, so the default size is slightly taller and lines up with buttons and selects. `size="xs"` is deprecated and renders as `sm`. Keyboard focus is now visible.
