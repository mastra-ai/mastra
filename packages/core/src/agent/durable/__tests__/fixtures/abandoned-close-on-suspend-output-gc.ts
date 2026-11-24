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

// Each segment must park, so a segment that ends without parking can't pass as retained. The resume parks the
// same tool call again, so its suspension only counts after the call resumed, not as a replay of the first one.
async function drainToSuspension(stream: AsyncIterable<any>, resumed: boolean): Promise<void> {
  let awaitingResume = resumed;
  let suspended = false;
  for await (const chunk of stream) {
    if (chunk.type === 'tool-call-resumed') awaitingResume = false;
    if (chunk.type === 'tool-call-suspended' && !awaitingResume) suspended = true;
  }
  if (!suspended) throw new Error(`${resumed ? 'resume' : 'stream'} ended without suspending`);
}

async function abandon(): Promise<WeakRef<object>> {
  // Threadless, closes at the suspension; the caller drains it and drops it.
  let result = await agent.stream('hi', { runId: 'abandoned', closeOnSuspend: true });
  await drainToSuspension(result.fullStream, false);
  if (process.env.SEGMENT === 'resume') {
    // A resume that suspends again parks its own output under the same run.
    result = await agent.resume('abandoned', { a: 'again' }, { closeOnSuspend: true });
    await drainToSuspension(result.fullStream, true);
  }
  // The stream's MastraModelOutput, which the run's cleanup release captures; not the result wrapper.
  return new WeakRef(result.output);
}

const output = await abandon();
// WAIT_MS below the cleanup timeout checks collection while the armed cleanup timer is still pending.
await new Promise(resolve => setTimeout(resolve, Number(process.env.WAIT_MS ?? cleanupTimeoutMs + 200)));
let collected = false;
for (let attempt = 0; attempt < 100 && !collected; attempt++) {
  gc();
  await new Promise<void>(resolve => setImmediate(resolve));
  collected = output.deref() === undefined;
  // A successful deref() keeps the target alive until the current job ends, so yield before the next gc().
  if (!collected) await new Promise<void>(resolve => setImmediate(resolve));
}
if (!collected) throw new Error('Abandoned closeOnSuspend output was not garbage collected');
process.send?.('ok');
process.exit(0);
