---
'@mastra/code-sdk': patch
---

Improved the errors `agent_signal_send` and `agent_connect` return for a peer id that no saved peer has. `agent_signal_send` now says `Cannot send: no saved peer has id <id>` instead of `peer is not saved`, which read as a sync bug when the id was only mistyped. When the id is a few characters off a saved peer's id in the same resource (including a stretch spliced in from another peer's id) or matches a saved peer's label, the error names up to three of those peers, for example `Did you mean code-agent:team:f4c572af-9c10-… ("reviewer")?`. Nothing is sent or saved until the agent retries with the exact id.
