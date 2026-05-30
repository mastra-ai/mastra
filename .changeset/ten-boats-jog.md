---
'@mastra/playground-ui': patch
'@mastra/react': patch
---

Fixed Studio chat rendering regressions:

- Streamed and uploaded files and images render again — the converter now reads the `mediaType`/`url` shape the SDK emits (with a fallback to the persisted `mimeType`/`data`).
- Reasoning blocks keep their text after a page reload by reading `details` when `reasoning` is empty.
- A message whose `dynamic-tool` failed is marked incomplete instead of complete.
- Observational Memory badges update correctly on stream interruption and reload — the helpers now read the nested `content.parts` shape of stored messages.
