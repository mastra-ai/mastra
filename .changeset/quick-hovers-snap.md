---
'@mastra/playground-ui': minor
---

Hover is now instant across the design system. Buttons, inputs, sidebar rows, tabs, breadcrumbs, table and tree rows, and row actions that appear on hover switch state immediately instead of fading over 150-200ms. Motion stays for things that move or arrive: popups opening, panels collapsing, the switch thumb, chevrons.

**Removed**

- `controlStateColorTransition` from `@mastra/playground-ui/primitives/transitions`. Drop it from your class lists; hover needs no transition.

```tsx
// Before
<button className={cn(quietTextHover, controlStateColorTransition)} />
// After
<button className={quietTextHover} />
```
