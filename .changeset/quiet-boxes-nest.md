---
'@mastra/playground-ui': minor
---

Added `variant="nested"` to `Table`. Use it for a table inside a card or dialog: it has the same rows and parts as `variant="inset"`, drawn as a box with no border of its own, so the table no longer looks like a card inside a card.

```tsx
// Before
<Card>
  <div className="p-1">
    <Table variant="inset">…</Table>
  </div>
</Card>

// After
<Card>
  <CardContent>
    <Table variant="nested">…</Table>
  </CardContent>
</Card>
```
