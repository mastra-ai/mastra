---
'@mastra/factory': patch
---

Removed the `disableScoreStorage` Factory option. Previously Mastra Code discarded scorer writes by default; it no longer runs those scorers, and other score writes use the configured storage. Remove the option from your configuration when upgrading:

Before:

```ts
const factory = new MastraFactory({ storage, disableScoreStorage: false });
```

After:

```ts
const factory = new MastraFactory({ storage });
```
