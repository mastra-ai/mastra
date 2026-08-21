---
'@mastra/factory': minor
---

Improved the Factory audit log with a density timeline, category filters, responsive rows, and automatic history loading. Intake binding changes now appear in the affected project's audit history.

```ts
const response = await fetch(
  `/web/factory/projects/${factoryProjectId}/audit?actions=factory.run.started&limit=50`,
);
const page = await response.json();
```
