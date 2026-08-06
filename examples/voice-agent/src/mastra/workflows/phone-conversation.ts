import { createStep, createWorkflow } from '@mastra/core/workflows';
import { pipeAgentReplyToWriter } from '@mastra/livekit';
import { z } from 'zod';

/**
 * Per-turn conversation workflow for the workflow-driven LiveKit entrypoint.
 *
 * `@mastra/livekit` runs this workflow once per detected caller turn, to completion — LiveKit
 * owns the turn boundary, so there is no suspend/resume. Each turn is two steps:
 *   1. classifyIntent — deterministic routing: an explicit, inspectable step that pins the
 *      caller's intent to a constrained enum, instead of the agent discovering the scenario
 *      mid-reply. This is what a workflow does better than instructions-only routing.
 *   2. generateResponse — the full `callCenter` agent answers with that intent's focus in front,
 *      streaming its reply and engaging the same caller-scoped memory as the agent path.
 *
 * The worker passes the new turn as `turn` and the resolved memory mapping as `memory`. The
 * reply step's `agent.stream(..., { memory })` backfills prior turns from the thread, so we never
 * carry conversation state in the workflow (transcript-as-truth, but memory-backed).
 */

// A discriminated union (rather than a single object with a union `role`) so the inferred type
// matches @mastra/livekit's VoiceTurnMessage and is accepted directly by agent.stream().
const messageSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('system'), content: z.string() }),
  z.object({ role: z.literal('user'), content: z.string() }),
  z.object({ role: z.literal('assistant'), content: z.string() }),
]);

const intentSchema = z.enum(['lead', 'inspection', 'callback', 'existing_job', 'general']);
type Intent = z.infer<typeof intentSchema>;

// The resolved memory mapping for the call: thread = this call, resource = the caller. Threaded
// in from the worker so the reply step's agent.stream engages working memory, recall, and OM.
const memorySchema = z.object({ thread: z.string(), resource: z.string().optional() }).nullish();

// The `.default(...)` values prepopulate Studio's "Run" form so you can try the workflow by hand:
// a single inspection-intent turn (which routes to `inspection` and triggers `checkServiceArea`)
// plus a test memory scope. They are a no-op for the LiveKit worker, which always passes a real
// `turn` and `memory` — defaults only apply when a field is omitted, i.e. a manual Studio run.
const turnInputSchema = z.object({
  turn: z
    .array(messageSchema)
    .describe(
      'The new caller turn the worker feeds each turn. For a manual run, one user message is enough — memory backfills the rest.',
    )
    .default([
      {
        role: 'user',
        content: "Hi, I'd like to book a roof inspection at 120 Market Street, zip code 94103. Can you come out?",
      },
    ]),
  memory: memorySchema
    .describe(
      'Caller-scoped memory (thread = call, resource = caller). These example ids let working memory and recall engage on a manual run.',
    )
    .default({ thread: 'studio-test-call', resource: 'studio-test-caller' }),
});

const classifiedSchema = turnInputSchema.extend({ intent: intentSchema });

const responseSchema = z.object({
  reply: z.string(),
  intent: intentSchema,
});

// Per-intent focus prepended to the front-desk agent for this turn only. System messages are not
// persisted to the thread, so this steers the reply without polluting the saved transcript.
const INTENT_GUIDANCE: Record<Intent, string> = {
  lead: 'The caller is a new prospect who wants work done. Find out which trade they need, the property, and a rough scope. If they are ready, look them up and book a site visit; otherwise capture the lead and call finalizeIntake with scenario "lead".',
  inspection:
    'The caller wants a roof inspection. Collect the property address and zip code, then call checkServiceArea before promising a visit. In area: take their name and number and book it, then finalizeIntake with scenario "inspection". Out of area: apologize that you do not cover it and offer a callback instead.',
  callback:
    'The caller wants a callback or has a request outside trades work. Collect their name, number, and the reason, then call finalizeIntake with scenario "callback".',
  existing_job:
    'The caller has an existing account or booked visit. Use lookupCustomer by phone or name first, then help them check availability, book, reschedule, or cancel a site visit.',
  general:
    'Answer the question briefly and find out what they need. If it is outside trades work, scheduling, or accounts, offer to take a callback.',
};

// Step 1: classify the caller's intent from the new turn.
const classifyIntent = createStep({
  id: 'classifyIntent',
  inputSchema: turnInputSchema,
  outputSchema: classifiedSchema,
  execute: async ({ inputData, mastra }) => {
    const result = await mastra.getAgent('triage').generate(inputData.turn, {
      structuredOutput: { schema: z.object({ intent: intentSchema }) },
    });
    return { ...inputData, intent: result.object?.intent ?? 'general' };
  },
});

// Step 2: generate the spoken reply with the full callCenter agent, streaming through the writer.
const generateResponse = createStep({
  id: 'generateResponse',
  inputSchema: classifiedSchema,
  outputSchema: responseSchema,
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const { turn, intent, memory } = inputData;
    const messages = [{ role: 'system' as const, content: INTENT_GUIDANCE[intent] }, ...turn];
    // The full callCenter agent answers: its tenant processor, tools, and — via `memory` — the
    // three memory layers all engage, exactly as on the agent path. `memory` scopes thread (call)
    // and resource (caller), so the agent backfills history and persists this turn.
    const stream = await mastra.getAgent('callCenter').stream(messages, {
      ...(memory ? { memory } : {}),
      abortSignal,
    });
    // pipeAgentReplyToWriter forwards the agent's text deltas (TTS starts early) AND its tool-call
    // chunks (so toolFeedback fires and onTurnComplete sees the tool list) into the step writer —
    // unlike piping only `.textStream`, which silently drops tool calls. Returns the spoken text.
    const reply = await pipeAgentReplyToWriter(stream, writer);
    return { reply, intent };
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
