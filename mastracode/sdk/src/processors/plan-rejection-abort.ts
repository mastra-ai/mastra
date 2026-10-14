/**
 * Processor that aborts the agentic loop immediately after a `submit_plan` tool
 * returns a rejection the user will follow up on in their next message. This
 * prevents the model from generating any text after the user clicks "Request
 * Changes" — the tool result is persisted in thread history (for context on the
 * next run) but no follow-up LLM call is made. A rejection that already carries
 * the user's feedback keeps the loop running so the model revises right away.
 */
import type { Processor, ProcessInputStepArgs } from '@mastra/core/processors';

const PLAN_REJECTED_PREFIX = 'Plan was not approved';
const PLAN_REVISION_REQUESTED_PREFIX = 'Plan was not approved. The user wants revisions.';

type ToolInvocation = {
  state?: string;
  toolName?: string;
  result?: unknown;
};

type ToolResultPart = {
  type?: string;
  name?: string;
  result?: unknown;
};

function resultText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const content = (result as { content?: unknown }).content;
    if (typeof content === 'string') return content;
  }
  return '';
}

function stopsForUserFeedback(text: string): boolean {
  return text.startsWith(PLAN_REJECTED_PREFIX) && !text.startsWith(PLAN_REVISION_REQUESTED_PREFIX);
}

function isPlanRejection(inv: ToolInvocation | undefined): boolean {
  if (!inv || inv.state !== 'result' || inv.toolName !== 'submit_plan') return false;
  return stopsForUserFeedback(resultText(inv.result));
}

function isPlanRejectionResultPart(part: ToolResultPart): boolean {
  return part.type === 'tool_result' && part.name === 'submit_plan' && stopsForUserFeedback(resultText(part.result));
}

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

      // Check for a submit_plan rejection tool result. Handle the primary
      // `content.parts` shapes (tool-invocation and harness-style tool_result)
      // plus the legacy `content.toolInvocations` array.
      const content = msg.content as { parts?: unknown[]; toolInvocations?: unknown[] } | unknown[] | undefined;

      const parts = Array.isArray(content) ? content : Array.isArray(content?.parts) ? content.parts : [];
      for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        const p = part as { type?: string; toolInvocation?: ToolInvocation } & ToolResultPart;
        if (p.type === 'tool-invocation' && isPlanRejection(p.toolInvocation)) {
          abort('Plan rejected by user — no further response needed');
          return undefined;
        }
        if (isPlanRejectionResultPart(p)) {
          abort('Plan rejected by user — no further response needed');
          return undefined;
        }
      }

      const legacy = !Array.isArray(content) && Array.isArray(content?.toolInvocations) ? content.toolInvocations : [];
      for (const inv of legacy) {
        if (isPlanRejection(inv as ToolInvocation)) {
          abort('Plan rejected by user — no further response needed');
          return undefined;
        }
      }

      // Only check the most recent assistant message.
      break;
    }

    return undefined;
  }
}
