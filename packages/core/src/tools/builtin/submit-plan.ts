import { z } from 'zod/v4';

import { createTool } from '../tool';

/**
 * Payload carried by the native `tool-call-suspended` event when `submit_plan` pauses.
 *
 * The tool only knows the plan `title`. Hosts derive the named plan file from that title,
 * read it from disk, and fill `path`/`plan` for approval rendering and history replay.
 */
export interface SubmitPlanSuspendPayload {
  title: string;
  path?: string;
  plan?: string;
}

/**
 * The action a host resumes a suspended `submit_plan` call with.
 *
 * `approved` means the user accepted the plan and the agent should proceed. `rejected`
 * means the user wants revisions; the optional `feedback` is surfaced to the model so it
 * can revise and submit again.
 *
 * Hosts that layer additional behavior on approval (e.g. a AgentController switching from a
 * planning mode to an execution mode) drive that from their own response handling; the
 * tool itself only reports the outcome back to the model.
 */
export interface SubmitPlanResumeData {
  action: 'approved' | 'rejected';
  feedback?: string;
  title?: string;
  path?: string;
  plan?: string;
}

const resumeSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
  title: z.string().optional(),
  path: z.string().optional(),
  plan: z.string().optional(),
});

/**
 * Built-in, agent-agnostic tool: submit an implementation plan for user review.
 *
 * Pausing uses the agent-native tool suspension primitive: the tool calls
 * `suspend({ title })`, which makes the agent emit a `tool-call-suspended` event and
 * persist run state. The host derives the named plan file from `title`, renders it,
 * collects an approve/reject decision, and continues the run via `agent.resumeStream({ action,
 * feedback })`; the tool re-runs with `resumeData` set to that decision and reports it
 * back to the model.
 *
 * This tool is deliberately host-agnostic: it does not know about AgentController modes or any
 * UI. A plain Agent (e.g. embedded in Studio or a customer app) can use it directly, and
 * a AgentController can layer mode-switch behavior on top of the approval in its own response
 * handling without the tool needing to change.
 *
 * The tool takes only the plan `title` — never the plan body or a user-controlled path.
 * The host derives the named file path from the title, so more than one plan can exist
 * over time without exposing arbitrary file reads through tool args. When executed without
 * an agent `suspend` (e.g. direct invocation outside an agent run), the tool returns the
 * title as readable text so the submission is still surfaced.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a plan you wrote to a markdown file for review. Pass the plan `title`; the host derives `.mastracode/plans/<slug>.md` from it and reads the file from disk. Write/edit that file first — do not paste the plan contents here. Reuse the same title/file across revisions; only create a new title/file for a genuinely new plan. The user can approve, reject, or request changes. On approval, the system automatically switches to the default mode so you can implement.',
  inputSchema: z.object({
    title: z.string().describe('Plan title. The host reads `.mastracode/plans/<slug(title)>.md` from disk.'),
  }),
  suspendSchema: z.object({
    title: z.string(),
    path: z.string().optional(),
    plan: z.string().optional(),
  }),
  resumeSchema,
  execute: async ({ title }, context) => {
    try {
      const resumeData = context?.agent?.resumeData as SubmitPlanResumeData | undefined;
      if (resumeData !== undefined) {
        if (resumeData.action === 'approved') {
          return {
            content: 'Plan approved. Proceed with implementation following the approved plan.',
            isError: false,
            submittedPlan: {
              title: resumeData.title,
              path: resumeData.path,
              plan: resumeData.plan,
            },
          };
        }

        if (resumeData.feedback) {
          return {
            content: `Plan was not approved. The user wants revisions.\n\nUser feedback: ${resumeData.feedback}\n\nPlease revise the plan based on the feedback and submit again with submit_plan.`,
            isError: false,
            submittedPlan: {
              title: resumeData.title,
              path: resumeData.path,
              plan: resumeData.plan,
            },
          };
        }

        // No inline feedback — the user will provide revision instructions in
        // their next chat message. Stop and wait for it.
        return {
          content:
            'Plan was not approved. The user will send revision instructions in their next message. Stop now and wait for the user to provide feedback before revising the plan.',
          isError: false,
          submittedPlan: {
            title: resumeData.title,
            path: resumeData.path,
            plan: resumeData.plan,
          },
        };
      }

      const suspend = context?.agent?.suspend;
      if (suspend) {
        // The host derives the plan path from `title`, reads that file to render the
        // approval UI, and fills path/plan into the resume payload for history replay.
        await suspend({ title });
        return;
      }

      // No agent context available: surface the submission as readable text so non-agent
      // execution paths still expose it to the model.
      return {
        content: `[Plan submitted for review]\n\nTitle: ${title}`,
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});
