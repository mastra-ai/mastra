---
'@mastra/factory': patch
---

Removed the unused `disableScoreStorage` Factory option. Remove it from your configuration when upgrading:

Before:

```ts
const factory = new MastraFactory({ storage, disableScoreStorage: false });
```

After:

```ts
const factory = new MastraFactory({ storage });
```
