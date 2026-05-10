import { z } from 'zod';
import { createTool } from '../tool';
import { ASK_USER_TOOL_ID, askUserOptionSchema, askUserSelectionModeSchema } from './shared';

const inputSchema = z.object({
  question: z.string().describe('The question to ask the user. Should be clear and specific.'),
  options: z
    .array(askUserOptionSchema)
    .optional()
    .describe('Optional choices. If provided, shows a selection list. If omitted, shows a free-text input.'),
  selectionMode: askUserSelectionModeSchema
    .optional()
    .describe('Controls how many options the user can select. Defaults to single_select when options are provided.'),
});

const outputSchema = z.object({
  answer: z
    .unknown()
    .describe("The user's response. Free-text string for open questions, label(s) for option selections."),
});

const resumeSchema = outputSchema;

/**
 * `askUser` — pause execution and ask the user a question.
 *
 * Calls `ctx.agent.suspend()` on first invocation, halting the agent loop.
 * The caller resumes with `{ answer }` (matching `resumeSchema`). Outside a
 * Harness this is `agent.resumeStream({ answer })`; inside a Harness it is
 * `Session.respondToQuestion({ answer })`.
 *
 * Harness routing keys off the tool ID (`ASK_USER_TOOL_ID`).
 */
export const askUser = createTool({
  id: ASK_USER_TOOL_ID,
  description: 'Ask the user a question and wait for their response. Use for clarification, validation, or decisions.',
  inputSchema,
  outputSchema,
  suspendSchema: z.object({}),
  resumeSchema,
  execute: async (_input, ctx) => {
    const resumeData = ctx.agent?.resumeData as z.infer<typeof resumeSchema> | undefined;
    if (resumeData !== undefined) return resumeData;

    if (!ctx.agent?.suspend) {
      throw new Error(`${ASK_USER_TOOL_ID} requires an agent execution context with suspend support.`);
    }

    await ctx.agent.suspend({});
    // suspend() never returns normally — the next invocation receives resumeData.
    return { answer: undefined };
  },
});
