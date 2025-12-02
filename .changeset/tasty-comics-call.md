---
'@mastra/playground-ui': patch
'@mastra/core': major
---

**Breaking Changes:**
- Moved `generateTitle` from `threads.generateTitle` to top-level memory option
- Changed default value from `true` to `false`
- Using `threads.generateTitle` now throws an error

**Migration:**
Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

**Playground:**
The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.
