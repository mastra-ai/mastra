---
'@mastra/inngest': patch
---

Fixed the Inngest durable engine losing `requestContext` and `tracingContext` when a suspended run is resumed. Core's engine persists both into the suspend snapshot (`persistStepUpdate`) and restores them on resume; the Inngest engine's snapshot writer omitted both, and its resume-event builder read `requestContext` from the snapshot only (ignoring any caller-provided context) and never carried `tracingContext` at all.

The effect was that any tool scoping its work by a `requestContext` value survived the initial run but broke after a tool approval — e.g. a workspace/filesystem tool keyed on `team_id`/`thread_id` wrote to an `anon` fallback once resumed — and the resumed turn started a fresh root span in a new trace instead of continuing the original.

`InngestWorkflow` now persists `requestContext` and `tracingContext` into the suspended snapshot, and `InngestAgent.resume()` merges caller-provided context over the snapshot (caller wins, matching core) and forwards the persisted `tracingContext` as `tracingOptions` so the resumed workflow span continues the original trace. `InngestAgentResumeOptions` gains a `requestContext` field for parity with core's `DurableAgent.resume()`.

Adds a cross-process regression test (real connect() worker) asserting the resumed tool sees the original `requestContext` and that the resumed turn stays in the original trace.
