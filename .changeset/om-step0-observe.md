---
'@mastra/memory': patch
---

Allow observational memory to fire observations on step 0, fixing the dead zone where a single user message above the threshold would never be observed (#16523).

The previous `stepNumber > 0` gate was inherited from the pre-async-buffering era and is now redundant: step 0 already activates buffered chunks with the same retention-floor cleanup contract, and reflection can already run on step 0. The new behavior:

- Observation runs on every step (including step 0) when `pendingTokens >= threshold` and no tool calls are pending.
- On step 0, pending input is persisted to storage before observation cleanup runs, preserving the message-persistence invariant.
- Lifecycle markers (`data-om-observation-start` / `-failed` / `-end`) land on the active pending assistant response message — previously they were silently dropped on step 0 because there was no assistant-role message yet. When no assistant message exists, the step seeds an empty assistant message using the active response `messageId` from `processInputStep`; the LLM's streamed response parts merge onto it via `MessageMerger.shouldMerge` (which keys on id equality for data-only assistant messages), keeping markers and the actual response on the same assistant turn.
