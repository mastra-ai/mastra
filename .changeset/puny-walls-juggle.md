---
'@mastra/duckdb': patch
'@mastra/clickhouse': patch
'@mastra/pg': patch
---

Declared feedback support in the observability store so servers report the `feedback` capability as available to clients.

```ts
// With one of these stores configured as the observability storage:
const { capabilities } = await client.getObservabilityCapabilities();

console.log(capabilities.feedback); // true
```
