import { z } from 'zod/v4';

import { createTool } from '../tool';

/**
 * Payload carried by the native `tool-call-suspended` event when `submit_plan` pauses.
 * Hosts read this to render the plan for review with approve/reject controls.
 */
export interface SubmitPlanSuspendPayload {
  title: string;
  plan: string;
}

/**
 * The action a host resumes a suspended `submit_plan` call with.
 *
 * `approved` means the user accepted the plan and the agent should proceed. `rejected`
 * means the user wants revisions; the optional `feedback` is surfaced to the model so it
 * can revise and submit again.
 *
 * Hosts that layer additional behavior on approval (e.g. a Harness switching from a
 * planning mode to an execution mode) drive that from their own response handling; the
 * tool itself only reports the outcome back to the model.
 */
export interface SubmitPlanResumeData {
  action: 'approved' | 'rejected';
  feedback?: string;
}

const resumeSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
});

/**
 * Built-in, agent-agnostic tool: submit an implementation plan for user review.
 *
 * Pausing uses the agent-native tool suspension primitive: the tool calls
 * `suspend({ title, plan })`, which makes the agent emit a `tool-call-suspended` event
 * and persist run state. The host renders the plan, collects an approve/reject decision,
 * and continues the run via `agent.resumeStream({ action, feedback })`; the tool re-runs
 * with `resumeData` set to that decision and reports it back to the model.
 *
 * This tool is deliberately host-agnostic: it does not know about Harness modes or any
 * UI. A plain Agent (e.g. embedded in Studio or a customer app) can use it directly, and
 * a Harness can layer mode-switch behavior on top of the approval in its own response
 * handling without the tool needing to change.
 *
 * When executed without an agent `suspend` (e.g. direct invocation outside an agent run),
 * the tool returns the plan as readable text so it is still surfaced.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a completed implementation plan for user review. The plan will be rendered as markdown and the user can approve, reject, or request changes. Use this when your exploration is complete and you have a concrete plan ready for review. On approval, the system automatically switches to the default mode so you can implement.',
  inputSchema: z.object({
    title: z.string().optional().describe("Short title for the plan (e.g., 'Add dark mode toggle')"),
    plan: z
      .string()
      .min(1)
      .describe('The full plan content in markdown format. Should include Overview, Steps, and Verification sections.'),
  }),
  suspendSchema: z.object({
    title: z.string(),
    plan: z.string(),
  }),
  resumeSchema,
  execute: async ({ title, plan }, context) => {
    try {
      const resolvedTitle = title || 'Implementation Plan';

      const resumeData = context?.agent?.resumeData as SubmitPlanResumeData | undefined;
      if (resumeData !== undefined) {
        if (resumeData.action === 'approved') {
          return {
            content: 'Plan approved. Proceed with implementation following the approved plan.',
            isError: false,
          };
        }

        if (resumeData.feedback) {
          return {
            content: `Plan was not approved. The user wants revisions.\n\nUser feedback: ${resumeData.feedback}\n\nPlease revise the plan based on the feedback and submit again with submit_plan.`,
            isError: false,
          };
        }

        // No inline feedback — the user will provide revision instructions in
        // their next chat message. Stop and wait for it.
        return {
          content:
            'Plan was not approved. The user will send revision instructions in their next message. Stop now and wait for the user to provide feedback before revising the plan.',
          isError: false,
        };
      }

      const suspend = context?.agent?.suspend;
      if (suspend) {
        await suspend({ title: resolvedTitle, plan });
        return;
      }

      // No agent context available: surface the plan as readable text so non-agent
      // execution paths still expose it to the model.
      return {
        content: `[Plan submitted for review]\n\nTitle: ${resolvedTitle}\n\n${plan}`,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});
