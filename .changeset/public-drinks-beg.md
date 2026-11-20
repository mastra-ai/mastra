---
'@mastra/playground-ui': minor
---

Added `CardIllustration`, a framed plate for a small drawing at the top of a card. It is the same plate the illustrated `InfoTooltip` panels use, and every plate in a set is the same size, so the drawings line up. The plate is hidden from screen readers, so the card's title and description name it.

```tsx
<CardLink href="/alerts/new?template=budget" className="block h-full">
  <CardContent className="flex flex-col gap-3">
    <CardIllustration>
      <BudgetDrawing />
    </CardIllustration>
    <CardTitle>Daily cost budget</CardTitle>
  </CardContent>
</CardLink>
```

Tag the part of a drawing that matters with `data-emphasis="grow-x"` (a horizontal bar gets longer), `"grow-y"` (a vertical bar gets taller), or `"pop"` (an item grows in place). When the card is hovered or focused, that part moves, the same way on every card (no motion with reduced motion, on touch screens, or on cards that can't be clicked). Paint it with `bg-(--illustration-accent)`, and pick its color with `tone` on `CardIllustration`: `destructive` (default), `warning`, `info`, or `success`.

Interactive cards also mark `aria-current="true"` by lighting their rim in the focus color, so the card for the page or item already open stays visible in a set.
