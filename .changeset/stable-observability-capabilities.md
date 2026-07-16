---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@internal/playground': patch
---

Added stable metrics and logs capability reporting for observability storage. The system packages response now includes `observabilityStorageCapabilities` with `metrics` and `logs` flags, enabling capability-based detection that is resilient to bundler-generated constructor name changes.

```typescript
const packages = await client.getSystemPackages();
console.log(packages.observabilityStorageCapabilities?.metrics); // true
console.log(packages.observabilityStorageCapabilities?.logs); // true
```

Studio now uses the capability response instead of relying on constructor names, with a fallback for older servers.
