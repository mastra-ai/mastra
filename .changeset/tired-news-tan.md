---
'@mastra/daytona': minor
---

Added domain allow lists for Daytona sandboxes.

```typescript
const sandbox = new DaytonaSandbox({
  domainAllowList: 'api.example.com,*.example.org',
});
```
