---
'@mastra/core': minor
---

Added glob pattern support for workspace configuration. The `list_files` tool now accepts a `pattern` parameter for filtering files (e.g., `**/*.ts`, `src/**/*.test.ts`). `autoIndexPaths` accepts glob patterns like `./docs/**/*.md` to selectively index files for BM25 search. Skills paths support globs like `./**/skills` to discover skill directories at any depth, including dot-directories like `.agents/skills`.

**`list_files` tool with pattern:**

```typescript
// Agent can now use glob patterns to filter files
const result = await workspace.tools.workspace_list_files({
  path: '/',
  pattern: '**/*.test.ts',
});
```

**`autoIndexPaths` with globs:**

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './project' }),
  bm25: true,
  // Only index markdown files under ./docs
  autoIndexPaths: ['./docs/**/*.md'],
});
```

**Skills paths with globs:**

```typescript
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './project' }),
  // Discover any directory named 'skills' within 4 levels of depth
  skills: ['./**/skills'],
});
```

Note: Skills glob discovery walks up to 4 directory levels deep from the glob's static prefix. Use more specific patterns like `./src/**/skills` to narrow the search scope for large workspaces.
