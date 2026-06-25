/**
 * Processor that aborts the agentic loop immediately after a `submit_plan` tool
 * returns a rejection result. This prevents the model from generating any text
 * after the user clicks "Request Changes" — the tool result is persisted in
 * thread history (for context on the next run) but no follow-up LLM call is made.
 */
import type { Processor, ProcessInputStepArgs } from '@mastra/core/processors';

const PLAN_REJECTED_PREFIX = 'Plan was not approved';

export class PlanRejectionAbortProcessor implements Processor<'plan-rejection-abort'> {
  id = 'plan-rejection-abort' as const;

  async processInputStep({ messages, stepNumber, abort }: ProcessInputStepArgs): Promise<undefined> {
    // Only act on continuation steps (stepNumber > 0) — step 0 is the initial
    // prompt where the model hasn't responded yet. After tool resume, the tool
    // result is part of step 0 and the loop advances to step 1 for the next
    // model call.
    if (stepNumber === 0) return undefined;

    // Walk messages from the end to find the last assistant message.
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg || msg.role !== 'assistant') continue;

      // Check for a submit_plan rejection tool result in this message's parts.
      const content = msg.content as { parts?: unknown[] } | undefined;
      const parts = content?.parts;
      if (!Array.isArray(parts)) break;

      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        const p = part as { type?: string; toolInvocation?: Record<string, unknown> };
        if (p.type !== 'tool-invocation') continue;

        const inv = p.toolInvocation;
        if (!inv || inv.state !== 'result' || inv.toolName !== 'submit_plan') continue;

        const result = inv.result as { content?: string } | string | undefined;
        const text = typeof result === 'string' ? result : typeof result?.content === 'string' ? result.content : '';

        if (text.startsWith(PLAN_REJECTED_PREFIX)) {
          abort('Plan rejected by user — no further response needed');
        }
      }

      // Only check the most recent assistant message.
      break;
    }

    return undefined;
  }
}
