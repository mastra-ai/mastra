---
'@mastra/memory': patch
---

Fixed observational memory so a single message that exceeds the token threshold now triggers an observation, even when it is the first message of a turn.

Previously such a message reached neither code path. The observation path required a step number above 0. The async buffering path required the pending token count to stay below the threshold. As a result the observer was never called, even with the default configuration.

**What changed**

- Step 0 now runs an observation when the threshold is exceeded and no tool calls are pending.
- The active assistant response message is seeded, so observation markers are stored on it instead of on a user message.
- The messages of the in-flight turn are kept during post-observation cleanup, so the model can still answer the prompt that triggered the observation.

Fixes #16523.
