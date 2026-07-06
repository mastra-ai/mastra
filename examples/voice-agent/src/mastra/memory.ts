import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
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
    // later calls. IMPORTANT: despite the name, the observer runs INLINE as an input-step
    // processor — it blocks the agent loop while it distills, so it IS on the caller's clock. Two
    // settings keep that cost small:
    //   - a fast, NON-reasoning model. The OM defaults are tuned for Gemini Flash with a tiny
    //     thinking budget; pointing it at a reasoning model like gpt-5-mini made it spend ~25s
    //     reasoning *inline* every time it fired (measured), stalling the reply.
    //   - a `messageTokens` threshold high enough that it fires occasionally, not every turn.
    //     Lower it to see OM fire sooner in a short demo; raise it (toward the 30k default) in
    //     production. The workers also force-flush OM once at call end via `onCallEnd` +
    //     `flushObservationalMemory` below, so this inline threshold is only a mid-call cap —
    //     every call is distilled at hang-up regardless.
    observationalMemory: {
      scope: 'resource',
      model: 'openai/gpt-4.1-mini',
      observation: { messageTokens: 1000 },
    },
    workingMemory: {
      enabled: true,
      scope: 'resource',
      // Fields are `.nullish()` (accept null and undefined), not `.optional()`: the model updates
      // the whole working-memory object each turn and emits `null` for fields it doesn't know yet.
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
 * Flush observational memory for a finished call — distill anything not yet observed into durable
 * facts for the caller's NEXT call. Meant to run from the LiveKit worker's `onCallEnd` hook, which
 * fires after the caller hangs up (off the audio path), so this never adds to in-call latency.
 *
 * `force: true` bypasses the `messageTokens` threshold above, so even a very short call is
 * distilled at hang-up (a call with nothing new to observe is still a no-op). With a guaranteed
 * end-of-call flush, the inline threshold can be raised high (toward the 30k default) for zero
 * in-call OM cost — the threshold then only matters for very long calls, where it caps how much
 * unobserved context accumulates mid-call.
 */
export async function flushObservationalMemory(mapping: { thread: string; resource?: string } | false): Promise<void> {
  if (!mapping) return;
  const om = await callCenterMemory.omEngine;
  if (!om) return;
  await om.observe({ threadId: mapping.thread, resourceId: mapping.resource ?? mapping.thread, force: true });
}
