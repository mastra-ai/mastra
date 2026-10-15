---
'@mastra/playground-ui': minor
---

Added a built-in chevron to `CollapsibleTrigger` for toggle rows you lay out yourself. `chevron="start"` or `chevron="end"` places the turning chevron before or after the label, and `chevronSize` picks 12, 14 or 16px (`xs`, `sm`, `md`).

```tsx
<CollapsibleTrigger chevron="start" chevronSize="xs" className="flex items-center gap-1 text-meta uppercase">
  Input
</CollapsibleTrigger>
```
