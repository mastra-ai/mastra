---
'@mastra/core': patch
---

`Workspace.destroy()` now releases indexed content.

Previously `destroy()` tore down the LSP, browser, sandbox and filesystem but left `_searchEngine` and `_skills` populated, so every document indexed into a workspace's BM25 index — and the source of every loaded skill version — stayed reachable for the lifetime of the process, even after `mastra.removeWorkspace(id, { destroy: true })`.

The search index and the skills registry are now cleared in a `finally` block, so they are released even when one of the resources above fails to shut down.
