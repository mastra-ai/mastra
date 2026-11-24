import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { z } from 'zod';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import { Agent } from '../../../agent';
import { createDurableAgent } from '../../create-durable-agent';

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with --expose-gc');

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const cleanupTimeoutMs = Number(process.env.CLEANUP_TIMEOUT_MS ?? 50);

const model = new MockLanguageModelV2({
  doStream: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream<any>([
      { type: 'stream-start', warnings: [] },
      { type: 'tool-call', toolCallType: 'function', toolCallId: 'call-1', toolName: 'ask', input: '{}' },
      { type: 'finish', finishReason: 'tool-calls', usage },
    ]),
  }),
});
const ask = createTool({
  id: 'ask',
  description: 'suspends until answered',
  inputSchema: z.object({}),
  suspendSchema: z.object({ q: z.string() }),
  resumeSchema: z.object({ a: z.string() }),
  execute: async (_input, ctx) =>
    (ctx.agent?.resumeData as { a?: string } | undefined)?.a === 'done' ? 'ok' : ctx.agent?.suspend({ q: '?' }),
});
const agent = createDurableAgent({
  agent: new Agent({ id: 'a', name: 'a', instructions: 'x', model: model as any, tools: { ask } }),
  cleanupTimeoutMs,
});
new Mastra({ storage: new InMemoryStore(), logger: false, agents: { a: agent } });

let collected = false;
const finalizer = new FinalizationRegistry(() => {
  collected = true;
});

async function abandon(): Promise<void> {
  // Threadless, closes at the suspension; the caller drains it and drops it.
  let result = await agent.stream('hi', { runId: 'abandoned', closeOnSuspend: true });
  for await (const _chunk of result.fullStream) {
    // drain to the suspension
  }
  if (process.env.SEGMENT === 'resume') {
    // A resume that suspends again parks its own output under the same run.
    result = await agent.resume('abandoned', { a: 'again' }, { closeOnSuspend: true });
    for await (const _chunk of result.fullStream) {
      // drain to the second suspension
    }
  }
  // The stream's MastraModelOutput, which the run's cleanup release captures; not the result wrapper.
  finalizer.register(result.output, undefined);
}

await abandon();
// WAIT_MS below the cleanup timeout checks collection while the armed cleanup timer is still pending.
await new Promise(resolve => setTimeout(resolve, Number(process.env.WAIT_MS ?? cleanupTimeoutMs + 200)));
for (let attempt = 0; attempt < 100 && !collected; attempt++) {
  gc();
  await new Promise<void>(resolve => setImmediate(resolve));
}
if (!collected) throw new Error('Abandoned closeOnSuspend output was not garbage collected');
process.send?.('ok');
process.exit(0);
