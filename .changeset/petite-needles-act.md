---
'@mastra/core': patch
---

Fixed manual thread renames being overwritten by Observational Memory. Renames now pin the title by default; pass `pin: false` for initial titles or regenerate the title to resume automatic naming.

```typescript
// Allow Observational Memory to refine a programmatic initial title.
await session.thread.rename({ title: 'Initial task title', pin: false });

// Pin a manually chosen title (the default).
await session.thread.rename({ title: 'My chosen title' });
```
