---
'@mastra/core': patch
---

When `mastra dev` runs, multiple processes can write to `provider-registry.json` concurrently (auto-refresh, syncGateways, syncGlobalCacheToLocal). This causes file corruption where the end of the JSON appears twice, making it unparseable.

The fix uses atomic writes via the write-to-temp-then-rename pattern. Instead of:

```ts
fs.writeFileSync(filePath, content, 'utf-8');
```

We now do:

```ts
const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;
fs.writeFileSync(tempPath, content, 'utf-8');
fs.renameSync(tempPath, filePath); // atomic on POSIX
```

`fs.rename()` is atomic on POSIX systems when both paths are on the same filesystem, so concurrent writes will each complete fully rather than interleaving.
