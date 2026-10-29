---
'@mastra/code-sdk': patch
---

Improved the error `agent_signal_send` and `agent_connect` return for a peer id that is not saved. When the id is a character or two off a saved peer's id in the same resource, or matches a saved peer's label, the error now names up to three of those peers, for example `Did you mean code-agent:team:f4c572af-9c10-… ("reviewer")?`. Nothing is sent or saved until the agent retries with the exact id.
