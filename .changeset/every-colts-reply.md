---
'@mastra/memory': minor
---

Updated the recall tool to support more precise message browsing for agents.

Agents using `recall` can now pass `partType` and `toolName` to narrow message results to specific parts, such as tool calls or tool results for one tool. This change also adds `threadId: "current"` support across recall modes and `anchor: "start" | "end"` for no-cursor message paging, making it easier to inspect recent thread activity and past tool usage.
