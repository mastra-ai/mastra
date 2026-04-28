---
'@mastra/core': patch
---

The internal `<subagent-meta />` tag is no longer appended to subagent tool result content. The tag was previously visible to the parent model in the tool result, which could cause it to be echoed back as literal markup in the parent's assistant text on subsequent turns. Live UIs continue to receive model / duration / tool-call information via the structured `subagent_*` events; history UIs read the persisted `tool_call.args.modelId`. `parseSubagentMeta` is retained so already-persisted threads carrying the legacy tag continue to render cleanly (and the tag is stripped before display in all cases).
