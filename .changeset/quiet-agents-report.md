---
'@mastra/ai-sdk': patch
---

Fixed `handleChatStream()` and `chatRoute()` no longer emitting `data-tool-agent` parts for sub-agents since 1.10.6, which left UIs that render live sub-agent progress with only the final tool output. Both now accept `includeSubAgentMetadata` (default `true`, matching the pre-1.10.6 behavior) and forward it to every stream conversion, including the v6/v7 approval-resume path. Pass `includeSubAgentMetadata: false` to leave the parts out. `toAISdkStream()` keeps its `false` default.
