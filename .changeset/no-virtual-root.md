---
'@mastra/core': minor
---

**Absolute paths now resolve to real filesystem locations instead of being treated as workspace-relative.**

Previously, `LocalFilesystem` in contained mode treated absolute paths like `/file.txt` as shorthand for `basePath/file.txt` (a "virtual-root" convention). This could silently resolve paths to unexpected locations — for example, `/Users/caleb/.config/file.txt` would resolve to `basePath/Users/caleb/.config/file.txt` instead of the real path.

Now:
- **Absolute paths** (starting with `/`) are real filesystem paths, subject to containment checks
- **Relative paths** (e.g., `file.txt`, `src/index.ts`) resolve against `basePath`
- **Tilde paths** (e.g., `~/Documents`) expand to the home directory

### Migration

If your code passes paths like `/file.txt` to workspace filesystem methods expecting them to resolve relative to `basePath`, change them to relative paths:

```ts
// Before
await filesystem.readFile('/src/index.ts');

// After
await filesystem.readFile('src/index.ts');
```

