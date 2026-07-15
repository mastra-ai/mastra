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

**`workflowBuilderAgent` now knows templates JSON-encode objects and arrays.**

The prompt used to teach that templates render primitives only and would throw on object/array values, pushing the builder toward workarounds like fake indexed access (`${stepResults.foreach-id.0.text}`, `.1.text`, …) up to a fixed slot count, or bailing out of `foreach` entirely in favor of a single agent that "loops internally". With the core template runtime now JSON-encoding non-primitive placeholders (see `@mastra/core` changeset), the builder is taught to write bare `${stepResults.<foreach-id>}` when handing a fan-out's `{ text }[]` result into a synthesis agent. New worked example: `list → mapping → bridge-agent-with-array-outputSchema → foreach(agent) → mapping-with-JSON-encoded-array → synthesis-agent`. The old indexed-slot approach is now an explicit anti-pattern.

**`workflowBuilderAgent` now has a clearer rule for adding a bridge agent before `foreach`.**

When the upstream step's top-level output is not already an array (typical for string-returning workspace tools like `find_files`), the previous guidance said to "ask for a tool that returns the array or fall back to a single code-agent that iterates internally" — which the builder correctly followed by opting out of `foreach`. The updated prompt promotes the bridge pattern instead: insert an `agent` step between the string/object-returning upstream and the `foreach`, with `outputSchema` set to an array (typically `Array<{ prompt: string }>` when the inner foreach step is an agent). A new anti-pattern calls out refusing `foreach` in this situation.

**`/workflows show` now renders the inner step of a `foreach` / `loop` / `parallel` / `conditional` container.**

Previously the diagram only printed the entry `type` (e.g. `foreach`, `loop`) with no indication of what was being iterated or fanned out. Container entries have no top-level `id` in the serialized graph, so linear-graph titles like `4. (unnamed)` were misleading. The renderer now synthesizes a container title from the inner step (`foreach(summarise-one)`, `dowhile(check)`, `parallel`, `conditional`), prints the container header line (`foreach — concurrency 3`, `parallel — 2 branches`, `dountil`), and lists each inner step on its own line with its kind and agent/tool id.
