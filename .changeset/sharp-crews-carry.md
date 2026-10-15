---
'@mastra/playground-ui': minor
---

Added a `disclosure` variant to `CollapsibleTrigger`: a ready-made toggle row for optional sections, with a chevron that turns while open and muted label text, lined up with the fields around it. Open, the row stretches into a section divider.

```tsx
<Collapsible>
  <CollapsibleTrigger variant="disclosure">Advanced</CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>
```
