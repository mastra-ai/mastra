import { z } from 'zod/v4';

import { createTool } from '../tool';

/**
 * Payload carried by the native `tool-call-suspended` event when `submit_plan` pauses.
 *
 * The tool can carry either a host-owned plan file `path` or an inline markdown `plan`.
 * Hosts with filesystem access can validate/read `path`; callers that already have the
 * markdown body available can include `title`/`plan` directly.
 */
export interface SubmitPlanSuspendPayload {
  path?: string;
  title?: string;
  plan?: string;
}

export interface SubmitPlanInput {
  path?: string;
  title?: string;
  plan?: string;
}

/**
 * The action a host resumes a suspended `submit_plan` call with.
 *
 * `approved` means the user accepted the plan and the agent should proceed. `rejected`
 * means the user did not accept the plan. The optional `feedback` carries a user comment
 * for either action; rejected plans with feedback can be revised immediately.
 *
 * Hosts that layer additional behavior on approval (e.g. a AgentController switching from a
 * planning mode to an execution mode) drive that from their own response handling; the
 * tool itself only reports the outcome back to the model.
 */
export interface SubmitPlanResumeData {
  action: 'approved' | 'rejected';
  feedback?: string;
  path?: string;
  title?: string;
  plan?: string;
}

const resumeSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  feedback: z.string().optional(),
  path: z.string().optional(),
  title: z.string().min(1).optional(),
  plan: z.string().optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSubmitPlanResumeData(value: unknown): value is SubmitPlanResumeData {
  if (!isRecord(value)) return false;

  const { action, feedback, path, title, plan } = value;

  return (
    (action === 'approved' || action === 'rejected') &&
    (feedback === undefined || typeof feedback === 'string') &&
    (path === undefined || typeof path === 'string') &&
    (title === undefined || (typeof title === 'string' && title.length > 0)) &&
    (plan === undefined || typeof plan === 'string')
  );
}

/**
 * Built-in, agent-agnostic tool: submit an implementation plan for user review.
 *
 * Pausing uses the agent-native tool suspension primitive: the tool calls `suspend(...)`,
 * which makes the agent emit a `tool-call-suspended` event and persist run state. The host
 * renders the submitted markdown body when provided, or validates/reads the submitted path
 * when it owns a filesystem flow. It then collects an approve/reject decision and optional
 * comment, then continues the run via `agent.resumeStream({ action, feedback })`; the tool
 * re-runs with `resumeData` set to that decision and reports it back to the model.
 *
 * This tool is deliberately host-agnostic: it does not know about AgentController modes or any
 * UI. A plain Agent (e.g. embedded in Studio or a customer app) can use it directly, and
 * a AgentController can layer mode-switch behavior on top of the approval in its own response
 * handling without the tool needing to change.
 *
 * The tool takes either a plan file `path` or an inline markdown `plan`. Hosts that own a
 * filesystem can use the path-backed flow; generic Studio agents and serverless previews can
 * pass `title`/`plan` directly without pretending a local file exists. When executed without
 * an agent `suspend` (e.g. direct invocation outside an agent run), the tool returns readable
 * text so the submission is still surfaced.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a plan for review. Provide either an inline markdown `plan` with an optional `title`, or a host-owned markdown file `path` (e.g. `plans/add-dark-mode.md`) when the host has a filesystem plan flow. Reuse the same path across revisions when using files. The user can approve or reject, optionally with a comment. On approval, hosts may switch modes or continue implementation.',
  inputSchema: z
    .object({
      path: z
        .string()
        .min(1)
        .optional()
        .describe('Optional path to a host-owned plan markdown file (e.g. `plans/add-dark-mode.md`).'),
      title: z.string().min(1).optional().describe('Optional display title for the submitted plan.'),
      plan: z.string().min(1).optional().describe('Optional markdown body to render inline in approval UIs.'),
    })
    .refine(data => data.path !== undefined || data.plan !== undefined, {
      message: 'submit_plan requires either a path or an inline plan body.',
    }),
  suspendSchema: z.object({
    path: z.string().optional(),
    title: z.string().optional(),
    plan: z.string().optional(),
  }),
  resumeSchema,
  execute: async ({ path, title, plan }: SubmitPlanInput, context) => {
    try {
      const resumeData = context?.agent?.resumeData;
      if (resumeData !== undefined) {
        if (!isSubmitPlanResumeData(resumeData)) {
          return { content: 'Invalid submit_plan resume data.', isError: true };
        }

        if (resumeData.action === 'approved') {
          return {
            content: [
              'Plan approved. Proceed with implementation following the approved plan.',
              resumeData.feedback ? `User comment: ${resumeData.feedback}` : undefined,
            ]
              .filter(Boolean)
              .join('\n\n'),
            isError: false,
            action: 'approved',
            ...(resumeData.feedback ? { feedback: resumeData.feedback } : {}),
            submittedPlan: {
              title: resumeData.title,
              path: resumeData.path,
              plan: resumeData.plan,
            },
          };
        }

        if (resumeData.feedback) {
          return {
            content: `Plan was not approved. The user wants revisions.\n\nUser comment: ${resumeData.feedback}\n\nPlease revise the plan based on the comment and submit again with submit_plan.`,
            isError: false,
            action: 'rejected',
            feedback: resumeData.feedback,
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
          action: 'rejected',
          submittedPlan: {
            title: resumeData.title,
            path: resumeData.path,
            plan: resumeData.plan,
          },
        };
      }

      const suspend = context?.agent?.suspend;
      if (suspend) {
        // Hosts with filesystem access can validate/read `path`. Callers that already
        // have the body can pass title/plan so approval UIs render immediately.
        await suspend({
          ...(path !== undefined ? { path } : {}),
          ...(title !== undefined ? { title } : {}),
          ...(plan !== undefined ? { plan } : {}),
        });
        return;
      }

      // No agent context available: surface the submission as readable text so non-agent
      // execution paths still expose it to the model.
      return {
        content: [
          `[Plan submitted for review]`,
          title ? `Title: ${title}` : undefined,
          path ? `Path: ${path}` : undefined,
          plan,
        ]
          .filter(Boolean)
          .join('\n\n'),
        isError: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { content: `Failed to submit plan: ${msg}`, isError: true };
    }
  },
});
