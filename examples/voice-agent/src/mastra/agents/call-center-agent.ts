import { Agent } from '@mastra/core/agent';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import {
  bookAppointment,
  cancelAppointment,
  checkAvailability,
  lookupCustomer,
  rescheduleAppointment,
} from '../tools/call-center-tools';
import { checkServiceArea, finalizeIntake } from '../tools/intake-tools';
import { voiceAgentDbUrl } from '../db';
import { workspaceContextProcessor } from '../processors/workspace-context';

export const callCenterAgent = new Agent({
  id: 'call-center',
  name: 'Meridian Trades Front Desk',
  description:
    'Front-desk voice agent for a multi-trade contractor: new leads, roof inspections with a service-area check, general callbacks, and scheduling for existing customers.',
  instructions: `You are Jordan, the friendly front-desk assistant for a trades contractor. The tenant context for this call — the company name, the trades it offers, and the service area — is given to you as a system message at the start of every turn. Use it and never invent services or areas.

You are on a PHONE CALL, so:
- Keep replies short: one or two sentences, then stop and let the caller respond.
- Never use lists, markdown, emojis, or special characters. Speak in plain sentences.
- Say times naturally ("two o'clock" not "14:00") and dates naturally ("Thursday, June twelfth").
- Ask for one piece of information at a time and confirm details back before you act.
- Read confirmation and reference codes back slowly, letter by letter and digit by digit.

Every call follows one of these paths. Listen for which one it is, and remember what you have already collected so you never ask twice:

1. New lead — the caller wants work done or a quote. Find out which trade they need, the property, and a rough idea of the job. If they are ready to book, look them up and schedule a site visit. Otherwise capture it as a lead.

2. Roof inspection — the caller wants a roof looked at. Collect the property address and zip code, then use checkServiceArea. If the zip is in the service area, take their name and number and book the inspection. If it is outside the service area, apologize that you do not cover that area and offer to take a callback instead.

3. General callback — the caller just wants someone to call them back. Collect their name, number, and the reason, and take a message.

4. Existing customer or scheduling — the caller references an existing account or a booked visit. Use lookupCustomer by phone or name first, then help them check availability or book, reschedule, or cancel a site visit.

If you have spoken with this caller before, earlier calls and what you learned about them are recalled for you automatically — greet them by name and reference what you remember instead of asking again.

Memory and pace, because this is a live call:
- Always speak your reply to the caller FIRST. Only update your working memory after you have responded — never make the caller wait on a memory update.
- Keep the working memory current with what you have collected (name, number, trade, address, zip, which path this is) so you never ask twice and so it is there next time they call.

At the END of the call, once you have everything, call finalizeIntake exactly once with the scenario ("lead", "inspection", or "callback") and the collected fields. It reconciles and submits the record and returns a reference number to read back — or it tells you what is still missing or that the address is out of area, which you must resolve before saying goodbye. Existing-customer scheduling handled with the booking tools does not need finalizeIntake.

Stay warm and professional. If a request is outside trades work, scheduling, or accounts, offer to take a callback.`,
  model: 'openai/gpt-5-mini',
  tools: {
    lookupCustomer,
    checkAvailability,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    checkServiceArea,
    finalizeIntake,
  },
  // Deterministic per-turn tenant context, injected before the model runs (mock "Firebase").
  inputProcessors: [workspaceContextProcessor],
  // Three layers of memory, scoped to the caller (`resource`) so they carry across calls:
  //   1. working memory — the structured fields collected during THIS call (see schema below)
  //   2. semantic recall — pulls the most relevant snippets of PRIOR calls into context
  //   3. observational memory — accumulates durable facts about the caller in the background
  // Storage is inherited from the Mastra instance; the vector index for semantic recall has to
  // be passed explicitly. Both live in the same `voice-agent.db` file (see ../db).
  memory: new Memory({
    // Semantic recall needs a vector index + an embedder. We reuse the OpenAI router that
    // already serves the agent model, so the example runs with just OPENAI_API_KEY. The
    // embedding is one small, LRU-cached network call per turn; if you need to shave that
    // round-trip, swap in a local embedder (e.g. `@mastra/fastembed`).
    vector: new LibSQLVector({ id: 'voice-agent-recall', url: voiceAgentDbUrl }),
    embedder: 'openai/text-embedding-3-small',
    options: {
      lastMessages: 20,
      // Cross-call recall for returning callers. Kept deliberately small (topK: 3, tight
      // message range) because recall runs synchronously before the reply — every extra
      // hit is latency the caller waits through. `scope: 'resource'` searches all of this
      // caller's past calls, not just the current one.
      semanticRecall: {
        topK: 3,
        messageRange: { before: 1, after: 1 },
        scope: 'resource',
      },
      // Durable, free-form facts about the caller, distilled by a background Observer agent
      // and injected into later calls. This runs OFF the turn's critical path — it never
      // delays a reply. The default model is Gemini Flash; we point it at the OpenAI model
      // the example is already set up for. `messageTokens` is lowered far below the 30k
      // default so the Observer fires within a single short demo call (a live test stalled
      // at ~1280 tokens against the old 1500 threshold and never distilled); raise it in
      // production, and route it to a cheap fast model (in a Gemini stack, Flash).
      observationalMemory: {
        scope: 'resource',
        model: 'openai/gpt-5-mini',
        observation: { messageTokens: 500 },
      },
      workingMemory: {
        enabled: true,
        scope: 'resource',
        // Fields are `.nullish()` (accept null and undefined), not `.optional()`: the model
        // updates the whole working-memory object each turn and emits `null` for fields it
        // doesn't know yet. A bare `.optional()` boolean rejects that null and drops the write.
        schema: z.object({
          callerName: z.string().nullish().describe("The caller's full name"),
          callerPhone: z.string().nullish().describe("The caller's phone number"),
          scenario: z
            .enum(['lead', 'inspection', 'callback', 'existing_job'])
            .nullish()
            .describe('Which call path this is'),
          trade: z.string().nullish().describe('The trade the caller needs, if any'),
          jobDescription: z.string().nullish().describe('Short description of the work'),
          propertyAddress: z.string().nullish().describe('Property street address'),
          zip: z.string().nullish().describe('Property zip code'),
          serviceAreaConfirmed: z
            .boolean()
            .nullish()
            .describe('Whether the zip was confirmed inside the service area'),
          notes: z.string().nullish().describe('Anything else worth remembering for next time'),
        }),
      },
    },
  }),
});
