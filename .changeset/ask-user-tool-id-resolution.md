---
'@internal/playground': patch
---

Studio: render the interactive Ask User widget regardless of the object key the built-in `askUserTool` is registered under. `ToolCard` now resolves a tool's intrinsic `id` from the tools list (`useTools`) and matches `ask_user` by id, so `tools: { askUserTool }` no longer hangs — previously only `tools: { ask_user: askUserTool }` (key === id) worked.
