---
'@mastra/core': patch
---

Fixed sequential `foreach` loops on the evented workflow engine running past a suspended item. Later items now start only after the suspended item is resumed, matching the default engine. This also fixes durable agents on the evented engine that could hang when you resume one of several tool calls that suspended in the same turn.
