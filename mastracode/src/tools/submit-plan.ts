/**
 * submit_plan tool — presents a completed plan for user review.
 * The plan renders inline in the chat as markdown with Approve/Reject/Edit options.
 * On approval, the system auto-switches to Build mode.
 * Follows the same async Promise pattern as ask_user.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v3';
import type { HarnessRuntimeContext } from '../harness/types.js';

let planCounter = 0;

export interface PlanApprovalResult {
  action: 'approved' | 'rejected';
  feedback?: string;
}

export const submitPlanTool = createTool({
  id: 'submit_plan',
  description: `Submit a completed implementation plan for user review. The plan will be rendered as markdown and the user can approve, reject, or request changes. Use this when your exploration is complete and you have a concrete plan ready for review. On approval, the system automatically switches to Build mode so you can implement.`,
  inputSchema: z.object({
    title: z.string().optional().describe("Short title for the plan (e.g., 'Add dark mode toggle')"),
    plan: z
      .string()
      .min(1)
      .describe('The full plan content in markdown format. Should include Overview, Steps, and Verification sections.'),
  }),
  execute: async ({ title, plan }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRuntimeContext | undefined;

      if (!harnessCtx?.emitEvent || !harnessCtx?.registerPlanApproval) {
        // Fallback: return the plan as text (no TUI available)
        return {
          content: `[Plan submitted for review]\n\nTitle: ${title || 'Implementation Plan'}\n\n${plan}`,
          isError: false,
        };
      }

      const planId = `plan_${++planCounter}_${Date.now()}`;

      // Block until user approves or rejects
      const result = await new Promise<PlanApprovalResult>(resolve => {
        harnessCtx.registerPlanApproval!(planId, resolve);

        harnessCtx.emitEvent!({
          type: 'plan_approval_required',
          planId,
          title: title || 'Implementation Plan',
          plan,
        } as any);
      });

      if (result.action === 'approved') {
        return {
          content:
            'Plan approved. The system has switched to Build mode. Proceed with implementation following the approved plan.',
          isError: false,
        };
      }

      const feedback = result.feedback ? `\n\nUser feedback: ${result.feedback}` : '';
      return {
        content: `Plan was not approved. The user wants revisions.${feedback}\n\nPlease revise the plan based on the feedback and submit again with submit_plan.`,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});
