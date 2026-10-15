---
'@mastra/playground-ui': minor
---

Added an Output column to the Traces table. It shows each trace's output preview, or its error in red when the trace failed, so you can see what a run returned without opening it. The column is on by default, sits next to Input, and can be hidden from the Columns menu. If you had customized your columns, Output is added next to Input when Input is shown. Servers that don't send output or error previews show an empty cell.
