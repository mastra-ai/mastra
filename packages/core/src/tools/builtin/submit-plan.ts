import { z } from 'zod';
import { createTool } from '../tool';
import { SUBMIT_PLAN_TOOL_ID } from './shared';

const inputSchema = z.object({
  title: z.string().optional().describe('Short title for the plan (e.g. "Add dark mode toggle")'),
  plan: z
    .string()
    .describe('The full plan content in markdown format. Should include Overview, Steps, and Verification sections.'),
});

const outputSchema = z.object({
  approved: z.boolean(),
  revision: z.string().optional().describe('Free-text revision notes supplied by the reviewer.'),
  transitionToMode: z
    .string()
    .optional()
    .describe('Mode id to switch to on approval (Harness consumer; ignored elsewhere).'),
});

const resumeSchema = outputSchema;

/**
 * `submitPlan` — pause execution and submit a plan for review.
 *
 * Suspends with the proposed `{ title?, plan }`. Reviewer resumes with
 * `{ approved, revision?, transitionToMode? }`. The agent receives the
 * resume payload back as the tool result and continues.
 *
 * Inside a Harness, `Session.respondToPlanApproval(...)` performs the resume
 * with this exact shape; when `approved` and `transitionToMode` is supplied
 * the harness also flips the active mode (or falls back to the submitting
 * mode's declared `transitionsTo`).
 */
export const submitPlan = createTool({
  id: SUBMIT_PLAN_TOOL_ID,
  description:
    'Submit a completed implementation plan for user review. The plan will be rendered as markdown and the user can approve, reject, or revise.',
  inputSchema,
  outputSchema,
  suspendSchema: z.object({}),
  resumeSchema,
  execute: async (_input, ctx) => {
    const resumeData = ctx.agent?.resumeData as z.infer<typeof resumeSchema> | undefined;
    if (resumeData !== undefined) return resumeData;

    if (!ctx.agent?.suspend) {
      throw new Error(`${SUBMIT_PLAN_TOOL_ID} requires an agent execution context with suspend support.`);
    }

    await ctx.agent.suspend({});
    return { approved: false };
  },
});
