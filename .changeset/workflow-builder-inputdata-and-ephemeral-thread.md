---
'@mastra/code-sdk': patch
---

Fix two `mastracode` workflow-runtime bugs that stopped chat-composed workflows from executing agent steps.

**`withEphemeralMemory` no longer strands inner agent invocations without a thread id.**

The helper that isolates workflow-agent-step memory used to swap in a fresh `MastraMemory` object but delete the reserved `MASTRA_THREAD_ID_KEY` from the request context. Inner agent invocations (e.g. `foreach(agent)` iterations) resolve their runtime thread through that reserved key — not through `MastraMemory` — so `prepare-memory-step` built a `MessageList` with `threadId: undefined`. The resulting messages then hit storage without a thread id and tripped the observational-memory tripwire ("Thread ID is required"). The helper now stamps both `MASTRA_THREAD_ID_KEY` and `MASTRA_RESOURCE_ID_KEY` to the ephemeral ids for the lifetime of `fn`, then restores or deletes them.

**`workflowBuilderAgent` no longer teaches `${inputData.<field>}` as a shortcut for workflow input.**

The prompt previously described `inputData` as "the WORKFLOW's input object" for all steps. That is only true for step 1 — after step 1 the engine binds `inputData` to the previous step's output, so `${inputData.<workflowInputField>}` templates silently reference the wrong scope. The prompt now teaches the correct three-scope model:

- `${initData.<field>}` — the workflow's initial input, valid from any step.
- `${inputData.<field>}` — the previous step's output, valid only when that output is known to be an object with that field.
- `${stepResults.<id>[.<path>]}` — a named earlier step's output; scalar step results resolve with no subpath.

Anti-patterns and worked examples were updated to match, and a new `foreach → summary` example demonstrates threading workflow input through `${initData.path}` from a mapping step.
