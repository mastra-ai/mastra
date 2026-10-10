---
'@mastra/core': patch
---

Fixed evented workflows dropping state changes made inside a nested workflow that runs as a `.dowhile()` or `.dountil()` loop body. Each iteration started from the state the loop had before the nested workflow ran, so `setState` updates from the loop body were lost and later steps never saw them. The nested workflow's final state now carries into the next iteration and the steps after the loop, matching the default engine.
