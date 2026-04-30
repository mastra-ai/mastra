---
'@mastra/playground-ui': minor
---

Refactored Button component to use a single `cva` (class-variance-authority) variant config instead of nested manual maps. Consolidated `IconButton` into `Button` via `size="icon-sm|icon-md|icon-lg"` and removed the `IconButton` export. Replaced `variant="light"` and `variant="inputLike"` with `variant="default"` (no behavior change for default styling). Added `cta` and `outline` variants and unified active/hover styles between text- and icon-mode buttons.

**Why:** A single source of truth for variants means consistent visuals, fewer drift bugs, simpler maintenance, and a more predictable surface for AI agents — single-variant cva is the dominant shadcn pattern across DS components in this repo (`Card`, `Input`, `Label`, `Textarea`, `StatusBadge`).

**Migration:**

```tsx
// Before
import { IconButton } from '@mastra/playground-ui';
<IconButton><Settings /></IconButton>
<Button variant="light">…</Button>
<Combobox variant="inputLike" />

// After
import { Button } from '@mastra/playground-ui';
<Button size="icon-md"><Settings /></Button>
<Button variant="default">…</Button>
<Combobox variant="default" />
```
