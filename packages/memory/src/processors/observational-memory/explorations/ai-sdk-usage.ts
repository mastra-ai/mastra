/**
 * How to use ObservationalMemory with the AI SDK (without Mastra agents)
 *
 * Design exploration — shows what the ideal developer experience looks like.
 *
 * Key insight: Memory handles threads and messages. OM handles observation.
 * Memory.getContext() assembles everything for the LLM call.
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

// ─── The ideal 3-step loop ──────────────────────────────────────────────────

async function chat(userMessage: string) {
  // 1. Get everything needed for the LLM call in one shot
  const ctx = await memory.getContext({ threadId });
  // Returns:
  // {
  //   systemMessage: string | undefined,  // observations + instructions + working memory
  //   messages: MastraDBMessage[],         // unobserved messages (or recent N if no OM)
  //   hasObservations: boolean,
  //   omRecord: OMRecord | null,
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
  // Returns:
  // {
  //   observed: boolean,    // did observation trigger?
  //   record: OMRecord,     // updated state
  // }

  if (obsResult.observed) {
    console.log('Observation triggered — messages compressed into observations');
  }

  return result.text;
}

// ─── Streaming version ──────────────────────────────────────────────────────

async function streamChat(userMessage: string) {
  const ctx = await memory.getContext({ threadId });

  const result = streamText({
    model: 'openai/gpt-4o',
    system: ctx.systemMessage,
    messages: [
      ...ctx.messages.map(toAiSdkMessage),
      { role: 'user', content: userMessage },
    ],
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }

  // Save and observe after streaming completes
  await memory.saveMessages({
    messages: [
      { id: crypto.randomUUID(), role: 'user', content: userMessage, threadId, createdAt: new Date() },
      { id: crypto.randomUUID(), role: 'assistant', content: fullText, threadId, createdAt: new Date() },
    ],
  });

  await om.observe({ threadId });
}

// ─── What getContext() does internally ───────────────────────────────────────
//
// Memory.getContext():
//   1. Gets OM engine (lazy, cached)
//   2. If OM is configured:
//      a. Gets OM record
//      b. Calls om.buildContextSystemMessage() → observations + instructions
//      c. Loads messages from storage after lastObservedAt (unobserved only)
//   3. If no OM:
//      a. Loads last N messages from storage
//   4. Gets working memory system message
//   5. Combines everything and returns
//

// ─── What observe() does ────────────────────────────────────────────────────
//
// om.observe({ threadId }):
//   1. Loads messages from storage (since lastObservedAt)
//   2. Counts tokens → checks against threshold
//   3. If threshold met → calls observer LLM to extract observations
//   4. If observation tokens exceed reflect threshold → calls reflector LLM
//   5. Returns { observed: boolean, record: OMRecord }
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
