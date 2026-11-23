---
'@mastra/core': patch
---

Fixed invalid durable agent resume data consuming suspended runs, so callers can retry with corrected data. Fixes #28229.

Resume data is now checked against the tool that will actually run: toolsets passed only to the first call, tools whose names were adjusted for the model, and runs pinned to a stored agent version are all covered. A resume whose tools fail to load is refused and the run stays suspended. A resume that waits on another one stops when its abort signal fires or its `modelSettings.timeout.totalMs` runs out, and a resume that loses a race is refused instead of answering the next suspension with its data.
