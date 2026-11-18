---
'@mastra/core': patch
---

Fixed evented workflows handing a resumed `foreach` item another item's suspend data. When several items of a `foreach` were suspended, a resumed item received the first suspended item's payload as `suspendData`, and an item started after a resume could receive it too. Each resumed item now gets its own payload, and an item that never suspended gets none. This also fixes evented agents with several suspended sub-agent tool calls, where approving one call could resume another call's sub-agent run.
