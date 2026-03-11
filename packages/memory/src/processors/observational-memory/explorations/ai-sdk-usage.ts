/**
 * How to use ObservationalMemory with the AI SDK (without Mastra agents)
 *
 * Design exploration — shows what the ideal developer experience looks like.
 *
 * Key insight: Memory handles threads and messages. OM handles observation.
 * Memory.getContext() assembles everything for the LLM call.
 *
 * Public API primitives on ObservationalMemory:
 *   getStatus({ threadId, resourceId? })  → status snapshot (shouldObserve, shouldBuffer, shouldReflect, canActivate)
 *   observe({ threadId, ... })            → synchronous observation (threshold-gated)
 *   buffer({ threadId, ... })             → create a buffered observation chunk (for async pre-computation)
 *   activate({ threadId, ... })           → merge buffered chunks into active observations
 *   reflect(threadId, resourceId?, ...)   → condense observations into a new generation
 *   getRecord(threadId, resourceId?)      → current OM record
 *   getObservations(threadId, ...)        → current observation text
 *   getHistory(threadId, ...)             → previous generations
 *   clear(threadId, ...)                  → delete all OM data
 */

// NOTE: This file is excluded from build via tsconfig.build.json.
// It's a design document, not production code.

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { MastraDBMessage } from '@mastra/core/agent';

// These would be real imports in a user's code:
// import { generateText, streamText } from 'ai';
// import { openai } from '@ai-sdk/openai';
// import { google } from '@ai-sdk/google';

declare function generateText(opts: any): Promise<{ text: string }>;
declare function streamText(opts: any): { textStream: AsyncIterable<string>; text: Promise<string> };

// ─── Setup ───────────────────────────────────────────────────────────────────

declare const memory: any; // Memory instance — handles threads, messages, working memory
declare const om: any; // ObservationalMemory engine — handles observations

const threadId = 'thread-123';

// ─── Simple usage: observe after each turn ──────────────────────────────────

async function chat(userMessage: string) {
  // 1. Get everything needed for the LLM call in one shot
  const ctx = await memory.getContext({ threadId });
  // Returns:
  // {
  //   systemMessage: string | undefined,              // observations + instructions + working memory
  //   messages: MastraDBMessage[],                     // unobserved messages (or recent N if no OM)
  //   hasObservations: boolean,
  //   omRecord: OMRecord | null,
  //   continuationMessage: MastraDBMessage | undefined, // OM continuation hint (caller places it)
  //   otherThreadsContext: string | undefined,          // cross-thread context (resource scope)
  // }

  // 2. Call the LLM — context slots right in
  const result = await generateText({
    model: 'openai/gpt-4o',
    system: ctx.systemMessage,
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      { role: 'user', content: userMessage },
    ],
  });

  // 3. Save messages (Memory handles this)
  await memory.saveMessages({
    messages: [
      { id: crypto.randomUUID(), role: 'user', content: userMessage, threadId, createdAt: new Date() },
      { id: crypto.randomUUID(), role: 'assistant', content: result.text, threadId, createdAt: new Date() },
    ],
  });

  // 4. Observe — OM loads messages from storage, decides if threshold is met
  const obsResult = await om.observe({ threadId });
  // Returns: { observed: boolean, reflected: boolean, record: OMRecord }

  if (obsResult.observed) {
    console.log('Observation triggered — messages compressed into observations');
  }

  return result.text;
}

// ─── Advanced usage: explicit buffering + activation ────────────────────────
//
// For long conversations where you want to pre-compute observations in the
// background (between steps or turns) rather than blocking the response.

async function chatWithBuffering(userMessage: string) {
  // 1. Get context
  const ctx = await memory.getContext({ threadId });

  // 1b. Activate any previously buffered observations
  const status = await om.getStatus({ threadId });
  // Returns:
  // {
  //   record, pendingTokens, threshold,
  //   shouldObserve, shouldBuffer, shouldReflect,
  //   bufferedChunkCount, bufferedChunkTokens, canActivate,
  // }

  if (status.canActivate) {
    const actResult = await om.activate({ threadId });
    // Returns: { activated: boolean, record, activatedMessageIds? }
    if (actResult.activated) {
      // Context has changed — re-fetch
      const freshCtx = await memory.getContext({ threadId });
      Object.assign(ctx, freshCtx);
    }
  }

  // 2. Call the LLM
  const result = await generateText({
    model: 'openai/gpt-4o',
    system: ctx.systemMessage,
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      { role: 'user', content: userMessage },
    ],
  });

  // 3. Save messages
  await memory.saveMessages({
    messages: [
      { id: crypto.randomUUID(), role: 'user', content: userMessage, threadId, createdAt: new Date() },
      { id: crypto.randomUUID(), role: 'assistant', content: result.text, threadId, createdAt: new Date() },
    ],
  });

  // 4. Check status and decide what to do
  const postStatus = await om.getStatus({ threadId });

  if (postStatus.shouldObserve) {
    // Threshold reached — full synchronous observation
    await om.observe({ threadId });
  } else if (postStatus.shouldBuffer) {
    // Below threshold but enough new content — buffer for later activation
    om.buffer({ threadId }); // fire-and-forget or await
  }

  // 5. Check if reflection is needed
  if (postStatus.shouldReflect) {
    await om.reflect(threadId);
    // Returns: { reflected: boolean, record }
  }

  return result.text;
}

// ─── AI SDK hooks integration ───────────────────────────────────────────────
//
// With AI SDK v5 / v6, these primitives map cleanly to lifecycle hooks:
//
//   prepareStep (step 0):  getContext() + activate()
//   onStepFinish:          saveMessages() + getStatus() → buffer() if shouldBuffer
//   onFinish:              observe() + reflect()
//

// ─── What each primitive does ───────────────────────────────────────────────
//
// getStatus({ threadId }):
//   Pure read. Loads unobserved messages from DB, counts tokens, checks thresholds.
//   Returns shouldObserve, shouldBuffer, shouldReflect, canActivate.
//
// observe({ threadId }):
//   Acquires lock, loads messages from DB, checks threshold, calls observer LLM.
//   Returns { observed, reflected, record }.
//
// buffer({ threadId }):
//   Loads unobserved messages from DB, calls observer LLM, stores result as
//   a "buffered chunk" (not yet merged into active observations).
//   Returns { buffered, record }.
//
// activate({ threadId }):
//   Reads buffered chunks from DB, merges into active observations via
//   storage.swapBufferedToActive(). No LLM call.
//   Returns { activated, record, activatedMessageIds }.
//
// reflect(threadId):
//   Calls reflector LLM on current observations, creates new generation.
//   Returns { reflected, record }.
//

// ─── Helper ─────────────────────────────────────────────────────────────────

function toAiSdkMessage(msg: MastraDBMessage) {
  let text = '';
  if (msg.content && typeof msg.content === 'object' && 'parts' in msg.content) {
    text = msg.content.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }
  return { role: msg.role as 'user' | 'assistant', content: text };
}
