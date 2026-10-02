/**
 * Finish reasons that terminate the agentic loop. The loop must NOT continue on
 * any of these, otherwise it re-sends the same request and spins until maxSteps
 * (or forever when maxSteps is unset).
 *
 * - `stop`: the model finished normally.
 * - `error`: the model stream failed.
 * - `length`: the model hit max_tokens; retrying reproduces the truncation
 *   (issue #15717).
 * - `content-filter`: a classifier block / model refusal (e.g. `claude-fable-5`
 *   surfaced by the AI SDK as `content-filter`). Retrying re-triggers the same
 *   refusal, so the run would hang indefinitely.
 *
 * Shared by the main loop (`llm-execution-step.ts`) and the durable loop
 * (`durable/workflows/steps/llm-execution.ts`) so the continuation policy
 * cannot drift between engines (#17893 parity port).
 */
export const TERMINAL_FINISH_REASONS = ['stop', 'error', 'length', 'content-filter'];
