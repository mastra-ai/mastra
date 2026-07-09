import { z } from 'zod/v4';

import { createTool } from '../tool';

/**
 * Payload carried by the native `tool-call-suspended` event when `submit_plan` pauses.
 *
 * The tool reads the plan markdown at `path` and inlines `title`/`plan` when the file is
 * available, so hosts render the plan (live, in storage, and on replay) without re-reading
 * it. When the file cannot be read the payload carries only `path` and the host falls back
 * to showing the path.
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
  title: z.string().optional(),
  plan: z.string().optional(),
});

/**
 * Built-in, agent-agnostic tool: submit an implementation plan for user review.
 *
 * Pausing uses the agent-native tool suspension primitive: the tool reads the plan file
 * and calls `suspend({ path, title, plan })`, which makes the agent emit a
 * `tool-call-suspended` event and persist run state. The host renders the plan, collects an
 * approve/reject decision, and continues the run via `agent.resumeStream({ action,
 * feedback })`; the tool re-runs with `resumeData` set to that decision and reports it
 * back to the model.
 *
 * This tool is deliberately host-agnostic: it does not know about AgentController modes or any
 * UI. A plain Agent (e.g. embedded in Studio or a customer app) can use it directly, and
 * a AgentController can layer mode-switch behavior on top of the approval in its own response
 * handling without the tool needing to change.
 *
 * The tool takes the plan file `path` and reads the plan body from disk itself (from a
 * `.md` file directly under `.mastracode/plans`), so the same file can be revised over time
 * and hosts never re-read it. When the file cannot be read the tool still suspends with just
 * `path`. When executed without an agent `suspend` (e.g. direct invocation outside an agent
 * run), the tool returns the path as readable text so the submission is still surfaced.
 */
export const submitPlanTool = createTool({
  id: 'submit_plan',
  description:
    'Submit a plan you wrote to a markdown file for review. Pass the `path` to that file (e.g. `.mastracode/plans/add-dark-mode.md`). Write/edit the file first — do not paste the plan contents here. Reuse the same file across revisions; only create a new file for a genuinely new plan. The user can approve, reject, or request changes. On approval, the system automatically switches to the default mode so you can implement.',
  inputSchema: z.object({
    path: z.string().describe('Path to the plan markdown file on disk (e.g. `.mastracode/plans/add-dark-mode.md`).'),
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
        // Read the plan body here and inline it into the suspend payload (like `ask_user`),
        // so the live stream, persisted metadata, and replay all carry it without any host
        // re-reading the file. Dynamic import keeps `node:fs` out of the static
        // `@mastra/core/tools` graph so browser bundles stay clean. Falls back to `{ path }`
        // when the file cannot be read, preserving the path-only rendering.
        const { getSubmitPlanProjectRoot, resolveLocalPlanPath, readPlanFile } = await import('./plan-file');
        const absPath = resolveLocalPlanPath(getSubmitPlanProjectRoot(), path);
        const file = absPath ? await readPlanFile(absPath) : undefined;

        await suspend(file ? { path, ...(file.title ? { title: file.title } : {}), plan: file.plan } : { path });
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
