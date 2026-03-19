---
'@mastra/core': minor
---

Added filesystem-level optimistic concurrency for file writes. When `expectedMtime` is provided in `WriteOptions`, the write will be rejected with a `StaleFileError` if the file was modified externally since it was last read. This provides defense-in-depth against external modifications (e.g., LSP-based editors) that occur between the tool-level mtime check and the actual write.

**New `expectedMtime` option on `WriteOptions`**

Any caller of `filesystem.writeFile()` can now opt into optimistic concurrency:

```ts
// Read a file and capture its mtime
const stat = await filesystem.stat('config.json');
const content = await filesystem.readFile('config.json');

// Later, write with mtime guard — fails if file changed externally
await filesystem.writeFile('config.json', newContent, {
  overwrite: true,
  expectedMtime: stat.modifiedAt,
});
```

If the file was modified between the read and write, a `StaleFileError` is thrown instead of silently overwriting.

**Automatic mtime pass-through for workspace tools**

When `requireReadBeforeWrite` is enabled, the `edit_file`, `write_file`, and `ast_edit` tools now automatically pass the recorded mtime through to the filesystem layer, providing a second line of defense beyond the existing tool-level read tracker check.
