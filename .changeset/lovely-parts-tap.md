---
'@mastra/playground-ui': minor
---

Fixed menus painting two hover backgrounds at once. DropdownMenu, ContextMenu, Select and Combobox rows no longer paint their own hover background under the moving highlight, destructive items tint that highlight instead of stacking a second one, and an open submenu keeps its parent row lit on the same surface. Moving the pointer or clicking inside a submenu no longer moves the parent menu's highlight or activates the parent row under it. PropertyFilter lists now use the same moving highlight, which also follows keyboard focus, and virtualized DataList rows no longer make the highlight blink while scrolling.

The moving highlight now runs on CSS transitions instead of `framer-motion`, which is no longer a dependency of `@mastra/playground-ui`. It fades in and travels as before, and appears instantly without the fade-out when the pointer leaves.

**Breaking:** the `@mastra/playground-ui/lib/springs` entry point is removed, and `FluidHoverHighlight` now takes only `hover` and `className`. Pass the `useFluidHover` return value as `hover`:

```tsx
const hover = useFluidHover(containerRef);
<FluidHoverHighlight hover={hover} className="rounded-lg" />;
```
