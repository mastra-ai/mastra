---
'@mastra/playground-ui': minor
---

Added a `form` variant to `CollapsibleTrigger` for an optional section inside a form or dialog body (Advanced, Request Context): a toggle row with a chevron that turns while open and muted label text, lined up with the fields around it. Open, the row stretches into a section divider.

```tsx
<Collapsible>
  <CollapsibleTrigger variant="form">Advanced</CollapsibleTrigger>
  <CollapsibleContent>…</CollapsibleContent>
</Collapsible>
```
