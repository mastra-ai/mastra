---
'@mastra/core': minor
---

Added component-scoped logging with custom filtering to ConsoleLogger

```typescript
new ConsoleLogger({
  level: 'debug',
  filter: ({ component }) => component === 'AGENT'
});
```
