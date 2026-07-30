import { LibSQLVector } from '@mastra/libsql';
import { Extractor, Memory, WorkingMemoryExtractor } from '@mastra/memory';
import { z } from 'zod';
import { saveCallSummary } from './backend';
import { voiceAgentDbUrl } from './db';

/**
 * Caller-scoped memory, shared by both entrypoints. The `callCenter` agent uses it directly; the
 * workflow worker passes the same instance as `memoryInstance` so the call thread is bootstrapped
 * and the greeting persisted on the workflow path too (where there is no agent to source it from).
 * One instance over one `voice-agent.db`, so a caller's working memory and recalled history are
 * identical whichever worker answered the call.
 *
 * Three layers, all `scope: 'resource'` (the caller), so they carry across calls:
 *   1. working memory — the structured fields collected during THIS call (schema below)
 *   2. semantic recall — pulls the most relevant snippets of PRIOR calls into context
 *   3. observational memory — accumulates durable facts about the caller in the background
 */
export const callCenterMemory = new Memory({
  // Semantic recall needs a vector index + an embedder. We reuse the OpenAI router that already
  // serves the agent model, so the example runs with just OPENAI_API_KEY. The embedding is one
  // small, LRU-cached network call per turn; to shave that round-trip, swap in a local embedder
  // (e.g. `@mastra/fastembed`). Both storage and this index live in the same `voice-agent.db`.
  vector: new LibSQLVector({ id: 'voice-agent-recall', url: voiceAgentDbUrl }),
  embedder: 'openai/text-embedding-3-small',
  options: {
    lastMessages: 20,
    // Cross-call recall for returning callers. Kept deliberately small (topK: 3, tight message
    // range) because recall runs synchronously before the reply — every extra hit is latency the
    // caller waits through. `scope: 'resource'` searches all of this caller's past calls.
    semanticRecall: {
      topK: 3,
      messageRange: { before: 1, after: 1 },
      scope: 'resource',
    },
    // Durable, free-form facts about the caller, distilled by an Observer agent and injected into
    // later calls. OM's job here is CROSS-CALL memory — it is not the end-of-call summary (that's
    // `summarizeCall` below, a separate one-shot concern). How OM fits this voice agent:
    //   - `scope: 'resource'` (the caller) is what makes facts span calls — but async background
    //     buffering is NOT yet supported with resource scope, so OM runs SYNCHRONOUSLY here: when
    //     unobserved messages cross `messageTokens`, the observer runs INLINE during a turn, on
    //     the caller's clock. Two settings keep that cost small: a fast, NON-reasoning observer
    //     model (a reasoning model like gpt-5-mini measured ~25s per inline fire), and a
    //     threshold sized so it fires rarely mid-call (3000 here — most demo calls end below it,
    //     so distillation usually happens on a later call; size it to comfortably exceed a
    //     typical call in production).
    //   - A call that ends below the threshold costs nothing: its messages are already
    //     persisted, and the observer distills them once a LATER call crosses the threshold —
    //     the distilled facts then ride every subsequent call's context.
    observationalMemory: {
      scope: 'resource',
      model: 'openai/gpt-5-mini',
      // NOTE: `observation.manageWorkingMemory: true` would be the more complete form of the
      // read-only setup below (the Observer would also extract fields whenever it fires
      // mid-call), but with resource-scoped working memory its extractor crashes in the
      // multi-thread observer ("no resourceId was provided") — core bug, filed separately.
      // Until that lands, working memory is written once per call by `summarizeCall` below.
      observation: { messageTokens: 3000 },
    },
    workingMemory: {
      enabled: true,
      scope: 'resource',
      // `agentManaged: false` moves working-memory writes OFF the caller's clock: the main agent
      // gets working memory as read-only context — no `updateWorkingMemory` tool, no "update
      // immediately" system instruction. On a live call the in-loop tool was the top UX offender,
      // in two ways: models re-state their reply after the tool result (the caller hears the
      // answer twice), and they sometimes write memory BEFORE replying (seconds of dead air).
      // Removing the tool removes both failure modes deterministically — no prompt discipline
      // required — and cuts the extra model step from every memory-writing turn. In-call "never
      // ask twice" is covered by `lastMessages` (the whole call is in context); cross-call fields
      // land at the end-of-call summary (`summarizeCall` below runs a WorkingMemoryExtractor).
      agentManaged: false,
      // Fields are `.nullish()` (accept null and undefined), not `.optional()`: the extractor
      // returns the whole working-memory object and emits `null` for fields it doesn't know yet.
      // A bare `.optional()` boolean rejects that null and drops the write.
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
        serviceAreaConfirmed: z.boolean().nullish().describe('Whether the zip was confirmed inside the service area'),
        notes: z.string().nullish().describe('Anything else worth remembering for next time'),
      }),
    },
  },
});

/**
 * What the business wants on file for every finished call. The schema-backed extractor runs as a
 * structured-output follow-up to the summarization pass, and its `onExtracted` hook writes the
 * record to the app's OWN storage (`saveCallSummary` in the mock backend) — not into Mastra
 * memory. `metadataKeyPath: false` keeps it out of memory metadata too, so the business owns the
 * record's lifecycle end to end (querying, retention, deletion).
 */
const callSummaryExtractor = new Extractor({
  name: 'call-summary',
  instructions:
    'Return a concise record of the call: who called, what they wanted, the caller sentiment, and any services they asked about.',
  schema: z.object({
    summary: z.string().describe('Two to three sentences: who called, what they wanted, any commitment or next step'),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    requestedServices: z.array(z.string()).describe('Services the caller asked about, e.g. "roof inspection"'),
  }),
  metadataKeyPath: false,
  onExtracted: async ({ current, threadId, resourceId }) => {
    await saveCallSummary({ callId: threadId, callerId: resourceId, ...current });
  },
});

/**
 * Summarize a finished call into the business's own records — one `summarizeThread()` call from
 * the LiveKit worker's `onCallEnd` hook, which fires after the caller hangs up and is awaited
 * within LiveKit's shutdown window (off the audio path, guaranteed to finish before the worker
 * process exits).
 *
 * `summarizeThread()` loads the call's messages and distills them with the same Observer plumbing
 * that powers observational memory — but as a standalone one-shot call, deliberately OUTSIDE the
 * OM lifecycle. Nothing is observed, buffered, or activated; the result goes only where the
 * extractor's hook puts it. That separation is the point: OM above owns durable cross-call facts
 * on its own cadence, while the per-call summary is the app's record, produced exactly once per
 * call regardless of length.
 */
export async function summarizeCall(mapping: { thread: string; resource?: string }): Promise<void> {
  try {
    await callCenterMemory.summarizeThread({
      model: 'openai/gpt-5-mini',
      threadId: mapping.thread,
      // Same fallback the live turn path uses (see onTurnComplete in the worker entrypoints): a
      // thread-only mapping still needs a resource id, since this memory is resource-scoped.
      resourceId: mapping.resource ?? mapping.thread,
      instructions:
        "Summarize this call for the contractor's office: who called, what they wanted, and any follow-up promised.",
      // Two extractors ride the one summarization pass: the business record above, and the
      // working-memory update. With `manageWorkingMemory` the main agent never writes working
      // memory in-loop, and most demo calls end below the Observer's token threshold — this
      // end-of-call extraction is what guarantees the caller's collected details (name, number,
      // zip, scenario) are in working memory before their next call.
      extract: [callSummaryExtractor, new WorkingMemoryExtractor()],
    });
  } catch (error) {
    // Runs from onCallEnd, awaited within LiveKit's shutdown window — a failure here (a flaky LLM
    // call, a broken extractor) must not prevent the worker from finishing shutdown.
    console.error('[memory] summarizeCall failed', error);
  }
}
