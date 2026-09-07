---
'@mastra/playground-ui': patch
---

Added the shared chat pieces both transcripts draw from. `ChatShell.Turn` reserves the reply room for a live turn, `groupTurns` folds a message list into turns, and `ai/tool-call` gains `ToolCallEdit` (an edit as removed and added lines, a written file as code), `ToolCallCommand`, `ToolCallGroup`, `toolEdit`, `stripAnsi` and `stripSerializedAnsi`. `Code` now exposes its `useHighlight` hook and `tokenStyle`, and `languageForPath` resolves a highlight language from a file path.
