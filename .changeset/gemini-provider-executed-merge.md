---
'@mastra/core': patch
---

Fixed Gemini 3 rejecting the next request with "Corrupted tool call context" when native Google Search (`webSearchTool`) and another tool (such as a skill) were called in the same step. The provider-executed flag from the tool call is now kept when its result arrives without one, so the search call and its result stay together in the conversation history.
