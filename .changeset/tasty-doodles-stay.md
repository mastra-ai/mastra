---
'@mastra/core': minor
---

Added an optional `persistenceLocation` capability to observability storage domains. Adapters can report `'local'` for embedded files, in-memory databases, and local replicas, or `'remote'` for database services. The built-in `InMemoryStore`, including Mastra's automatic fallback when no storage is configured, reports `'local'`. The default is `undefined` for adapters that do not report a location.

```ts
const observability = await storage.getStore('observability');
const location = observability?.persistenceLocation; // 'local', 'remote', or undefined
```
