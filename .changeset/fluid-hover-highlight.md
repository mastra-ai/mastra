---
'@mastra/playground-ui': minor
---

Added the Fluid Hover system so lists and menus can show a single highlight that glides between rows as the cursor moves, instead of each row flashing its own hover state.

```tsx
import { useFluidHover, useRegisterFluidHoverItem } from '@mastra/playground-ui/hooks/use-fluid-hover';
import { FluidHoverHighlight } from '@mastra/playground-ui/components/fluid-hover-highlight';

const list = useRef<HTMLDivElement>(null);
const hover = useFluidHover(list);

<div ref={list} className="relative" {...hover.handlers}>
  <FluidHoverHighlight hover={hover} className="bg-surface3 rounded-md" />
  {items.map((item, index) => (
    <Row key={item.id} index={index} registerItem={hover.registerItem} />
  ))}
</div>;
```

Spring presets are exported from `@mastra/playground-ui/lib/springs`. The highlight respects `prefers-reduced-motion` and snaps instead of travelling.

`DropdownMenu`, `ContextMenu`, `Select`, `Combobox`, `Command` and `CommandPalette` now use it out of the box: rows no longer paint their own hover/highlighted background; a single `bg-surface5` surface (two steps above the `bg-surface3` popup) follows the pointer and keyboard highlight. `CommandList` accepts `highlightClassName` to restyle that surface.
