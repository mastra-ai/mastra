---
'@mastra/ai-sdk': patch
---

fix(ai-sdk): populate response.messages in data-tool-agent events for nested agents

In nested agent setups, `part.data.response.messages` (and per-step
`steps[i].response.messages`) was always empty in `data-tool-agent` events.

The `finish` and `step-finish` payloads originate from `LLMIterationData`,
which has no `response` field. `transformAgent` tried to read
`payload.payload.response?.messages` — always `undefined` — and fell back to
the initial `[]` set in the `start` case.

The fix falls back to `payload.payload.messages?.nonUser`, which IS present in
`LLMIterationData` and carries the accumulated model-format response messages
from the sub-agent run. When `response.messages` is explicitly provided it
still takes priority.

Fixes #15051.
