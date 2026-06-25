import { z } from 'zod/v4';

import { createTool } from '../tool';

/**
 * Payload carried by the native `tool-call-suspended` event when `submit_plan` pauses.
 *
 * The tool only knows the `path` the agent wrote its plan to. Hosts read that file to
 * render the plan for review with approve/reject controls and derive the title from the
 * file's leading `# heading`. `title`/`plan` are filled in by the host, not the tool.
 */
export interface SubmitPlanSuspendPayload {
  path: string;
  title?: string;
  plan?: string;
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
 * `suspend({ path })`, which makes the agent emit a `tool-call-suspended` event and
 * persist run state. The host reads the plan file at `path`, renders it, collects an
 * approve/reject decision, and continues the run via `agent.resumeStream({ action,
 * feedback })`; the tool re-runs with `resumeData` set to that decision and reports it
 * back to the model.
 *
 * This tool is deliberately host-agnostic: it does not know about Harness modes or any
 * UI. A plain Agent (e.g. embedded in Studio or a customer app) can use it directly, and
 * a Harness can layer mode-switch behavior on top of the approval in its own response
 * handling without the tool needing to change.
 *
 * The tool takes only the `path` to the plan file the agent wrote — never the plan body.
 * Keeping plans as real files on disk lets the agent maintain more than one plan over time
 * and lets the host read/diff the exact content the user reviews. When executed without an
 * agent `suspend` (e.g. direct invocation outside an agent run), the tool returns the path
 * as readable text so the submission is still surfaced.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a plan you wrote to a markdown file for review. Pass the `path` to that file (e.g. `.mastracode/plans/add-dark-mode.md`). Write/edit the file first — do not paste the plan contents here. Reuse the same file across revisions; only create a new file for a genuinely new plan. The user can approve, reject, or request changes. On approval, the system automatically switches to the default mode so you can implement.',
  inputSchema: z.object({
    path: z
      .string()
      .describe('Path to the markdown file containing the plan (e.g. `.mastracode/plans/add-dark-mode.md`)'),
  }),
  suspendSchema: z.object({
    path: z.string(),
    title: z.string().optional(),
    plan: z.string().optional(),
  }),
  resumeSchema,
  execute: async ({ path }, context) => {
    try {
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
        // The agent wrote the plan to `path`; the host reads that file to render the
        // approval UI and derive the title. The tool only knows the path, so it suspends
        // with empty title/plan placeholders for the host to fill from disk.
        await suspend({ path, title: '', plan: '' });
        return;
      }

      // No agent context available: surface the submission as readable text so non-agent
      // execution paths still expose it to the model.
      return {
        content: `[Plan submitted for review]\n\nPath: ${path}`,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});
