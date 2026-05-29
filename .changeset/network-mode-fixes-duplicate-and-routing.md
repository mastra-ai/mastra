---
'@mastra/react': patch
---

Fix two network-mode regressions:

- The user message is no longer appended twice when calling `sendMessage({ mode: 'network', ... })`. `sendMessage` already seeds the user message, so the network path no longer re-pushes it before streaming network chunks.
- Routing-agent decisions are no longer rendered as a raw JSON code block in the assistant thread. `routing-agent-text-delta` chunks are now buffered, parsed once a JSON object is balanced, and stored on the assistant message's `content.metadata.routingDecision` (with a `routingDecisionText` fallback for non-JSON routing prose). The playground surfaces the parsed decision through the existing agent/tool/workflow network-choice metadata dialog instead of inlining JSON above the agent badge.
- After a page reload, the persisted network routing-decision JSON is no longer shown as a raw text message. The playground converter now reconstructs the persisted `{ "isNetwork": true, ... }` text part into the same network `dynamic-tool`/metadata message that streaming produces (`mode: 'network'`, `from`, `selectionReason`, `agentInput`, plus `childMessages`/`result` derived from `finalResult`), so the nested agent/tool/workflow badge and its child messages render identically whether the run just streamed or was restored on reload (network mode is being deprecated).
