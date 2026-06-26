import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

/**
 * Per-turn conversation workflow for the workflow-driven LiveKit entrypoint.
 *
 * `@mastra/livekit` runs this workflow once per detected caller turn, to completion — LiveKit
 * owns the turn boundary, so there is no suspend/resume and no conversation state is carried
 * between turns. The full transcript is passed in each turn as `history`, which keeps the
 * workflow stateless (transcript-as-truth).
 *
 * The shape mirrors a real multi-step turn: classify the caller's intent, then generate the
 * spoken reply with that intent in focus. The reply step streams its tokens through the step
 * `writer` so text-to-speech starts before the full reply is ready.
 */

// A discriminated union (rather than a single object with a union `role`) so the inferred type
// matches @mastra/livekit's VoiceTurnMessage and is accepted directly by agent.stream().
const messageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('system'), content: z.string() }),
  z.object({ role: z.literal('user'), content: z.string() }),
  z.object({ role: z.literal('assistant'), content: z.string() }),
]);

const intentSchema = z.enum(['new_lead', 'existing_job', 'scheduling', 'general']);
type Intent = z.infer<typeof intentSchema>;

const turnInputSchema = z.object({
  history: z.array(messageSchema),
});

const classifiedSchema = z.object({
  history: z.array(messageSchema),
  intent: intentSchema,
});

const responseSchema = z.object({
  reply: z.string(),
  intent: intentSchema,
});

// Per-intent focus prepended to the front-desk agent for this turn only.
const INTENT_GUIDANCE: Record<Intent, string> = {
  new_lead:
    'The caller is a new prospect. Find out which trade they need, the property, and a rough scope, then offer to book a site visit.',
  existing_job:
    'The caller has an existing account or job. Look them up by phone or name and help with their current work.',
  scheduling:
    'The caller wants to book, move, or cancel a site visit. Confirm the trade, offer a slot, and read back the confirmation code.',
  general:
    'Answer the question briefly. If it is outside trades work, scheduling, or accounts, offer to take a message.',
};

// Step 1: classify the caller's intent from the running transcript.
const classifyIntent = createStep({
  id: 'classifyIntent',
  inputSchema: turnInputSchema,
  outputSchema: classifiedSchema,
  execute: async ({ inputData, mastra }) => {
    const { history } = inputData;
    const result = await mastra.getAgent('triage').generate(history, {
      structuredOutput: { schema: z.object({ intent: intentSchema }) },
    });
    return { history, intent: result.object?.intent ?? 'general' };
  },
});

// Step 2: generate the spoken reply, streaming tokens through the writer so TTS starts early.
const generateResponse = createStep({
  id: 'generateResponse',
  inputSchema: classifiedSchema,
  outputSchema: responseSchema,
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const { history, intent } = inputData;
    const messages = [{ role: 'system' as const, content: INTENT_GUIDANCE[intent] }, ...history];
    const stream = await mastra.getAgent('callCenter').stream(messages, { abortSignal });
    // Piping textStream into the step writer surfaces tokens as `workflow-step-output` chunks,
    // which @mastra/livekit forwards to text-to-speech. Passing abortSignal through lets
    // barge-in stop generation promptly.
    await stream.textStream.pipeTo(writer);
    return { reply: await stream.text, intent };
  },
});

export const phoneConversationWorkflow = createWorkflow({
  id: 'phoneConversation',
  inputSchema: turnInputSchema,
  outputSchema: responseSchema,
})
  .then(classifyIntent)
  .then(generateResponse)
  .commit();
