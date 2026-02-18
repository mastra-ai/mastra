---
"@mastra/core": patch
"@mastra/server": patch
---

Partial assistant replies are now preserved when a client disconnects mid-stream (e.g. browser refresh or network drop). Previously, messages were silently lost — now whatever the agent generated before the disconnect is saved to message history and visible when the user returns.

Three changes:

- Added abort handling in the stream transformer so partial responses are persisted on disconnect instead of being silently dropped.
- Broadened abort detection to work with all providers. Some providers throw non-standard errors on disconnect (e.g. "Client connection prematurely closed") that were not previously recognized as aborts.
- Server stream handlers now consume the stream to completion in the background, ensuring persistence callbacks execute even when the HTTP response is cancelled.

Fixes #6715.
