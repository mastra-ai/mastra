/* eslint-disable */
/**
 * AI SDK usage with ObservationalMemory primitives
 *
 * Primitives on ObservationalMemory:
 *   getStatus({ threadId })               → token counts, thresholds, shouldObserve/shouldBuffer/shouldReflect/canActivate
 *   observe({ threadId, messages? })      → run observer LLM, update active observations. Returns { observed, reflected, record }
 *   buffer({ threadId, messages? })       → run observer LLM on subset, store as pending chunk. Returns { buffered, record }
 *   activate({ threadId })                → merge pending chunks into active (no LLM, fast). Returns { activated, record, activatedMessageIds? }
 *   reflect(threadId, resourceId?, ...)   → run reflector LLM, create new generation. Returns { reflected, record }
 *
 * NOTE: This file is excluded from build via tsconfig.build.json.
 */

declare function generateText(opts: any): Promise<any>;
declare const memory: any;
declare const om: any;

const threadId = 'thread-123';

// ═══════════════════════════════════════════════════════════════════════════════
// CASE 1: Simple single-turn
// ═══════════════════════════════════════════════════════════════════════════════

async function simpleTurn(userMessage: string) {
  // 1. Get context (observations + unobserved messages)
  const ctx = await memory.getContext({ threadId });

  // 2. Call LLM
  const result = await generateText({
    model: 'openai/gpt-4o',
    system: ctx.systemMessage,
    messages: [...ctx.messages, { role: 'user', content: userMessage }],
  });

  // 3. Save messages
  await memory.saveMessages({
    threadId,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: result.text },
    ],
  });

  // 4. Observe (blocks, but we're done with the response)
  const { observed, reflected } = await om.observe({ threadId });

  return result.text;
}


// ═══════════════════════════════════════════════════════════════════════════════
// CASE 2: Multi-step with buffering
// ═══════════════════════════════════════════════════════════════════════════════
//
// In a multi-step tool-calling flow, context grows with each step.
// We use the primitives in AI SDK hooks to manage observation.

async function multiStepWithBuffering(userMessage: string) {
  // Get initial context
  const ctx = await memory.getContext({ threadId });

  // Try to activate any buffered chunks from previous turns
  const actResult = await om.activate({ threadId });

  const result = await generateText({
    model: 'openai/gpt-4o',
    maxSteps: 10,
    system: ctx.systemMessage,
    messages: [...ctx.messages, { role: 'user', content: userMessage }],

    async onStepFinish({ response }: any) {
      // Save this step's messages to storage
      await memory.saveMessages({ threadId, messages: response.messages });

      // Check status after saving
      const status = await om.getStatus({ threadId });

      if (status.shouldObserve) {
        // Threshold met — activate any buffered chunks, then observe remainder
        if (status.canActivate) {
          await om.activate({ threadId });
        }
        await om.observe({ threadId });
      } else if (status.shouldBuffer) {
        // Not at threshold, but enough accumulated to pre-compute
        await om.buffer({ threadId });
      }
    },

    async prepareStep({ stepNumber }: any) {
      if (stepNumber === 0) return;

      // Rebuild context with latest observations
      const freshCtx = await memory.getContext({ threadId });
      return {
        system: freshCtx.systemMessage,
        messages: [...freshCtx.messages, { role: 'user', content: userMessage }],
      };
    },
  });

  // Final observation after the turn
  const { observed } = await om.observe({ threadId });

  // Reflect if needed
  if (observed) {
    const freshStatus = await om.getStatus({ threadId });
    if (freshStatus.shouldReflect) {
      await om.reflect(threadId);
    }
  }

  return result.text;
}


// ═══════════════════════════════════════════════════════════════════════════════
// CASE 3: Background worker
// ═══════════════════════════════════════════════════════════════════════════════
//
// A cron job or queue worker that processes threads independently.
// No agent loop, no AI SDK — just the primitives.

async function backgroundWorker(threadIds: string[]) {
  for (const tid of threadIds) {
    const status = await om.getStatus({ threadId: tid });

    if (status.shouldObserve) {
      // Activate any buffered chunks first
      if (status.canActivate) {
        await om.activate({ threadId: tid });
      }
      // Then observe remaining unobserved messages
      await om.observe({ threadId: tid });

      // Check if reflection is needed
      const freshStatus = await om.getStatus({ threadId: tid });
      if (freshStatus.shouldReflect) {
        await om.reflect(tid);
      }
    } else if (status.shouldBuffer) {
      await om.buffer({ threadId: tid });
    }
  }
}
