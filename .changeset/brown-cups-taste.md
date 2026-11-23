---
'@mastra/core': patch
---

Fixed invalid durable agent resume data consuming suspended runs, so callers can retry with corrected data. Fixes #28229.

Resume data is now checked against the tool that will actually run. This covers toolsets passed only to the first call, tool names changed to fit the model's naming rules, and runs pinned to a stored agent version.

A resume is refused, and the run stays suspended, when its tools fail to load or when the caller's tools do not include the suspended tool. This holds whether or not the run is still in memory. Tools that the agent's `defaultOptions` gave only to the caller who started the run are not passed on to a later caller. Toolsets and client tools passed to `resume()` replace the starting call's ones with the same name.

A resume that waits on another one stops when its abort signal fires or its `modelSettings.timeout.totalMs` runs out. When two requests try to resume the same run, one of them is refused. The refused request's data is never used to answer a later suspension, including when the run moves on during a version lookup or while several tool calls were waiting. Separate Mastra instances in one process can resume runs that share a run ID and tool call ID.
