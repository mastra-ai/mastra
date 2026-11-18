/**
 * Measures main-thread CPU for observational memory recall and observe on a large thread.
 *
 * The fixture mirrors the threads seen in production saturation: about 90 messages and about 2MB of
 * stored content, dominated by large tool results (diffs and command output). Models are stubbed, so
 * every millisecond reported is local work on the event loop thread.
 *
 * Usage (from packages/memory):
 *   pnpm tsx scripts/bench/om-large-thread.ts [--iterations 20]
 *   node --cpu-prof --cpu-prof-dir=/tmp/om-prof --import tsx scripts/bench/om-large-thread.ts
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';

import { Memory } from '../../src/index';
import { TokenCounter } from '../../src/processors/observational-memory/token-counter';

const iterationsArg = process.argv.indexOf('--iterations');
const ITERATIONS = iterationsArg > -1 ? Number(process.argv[iterationsArg + 1]) : 20;
const THREAD_ID = 'bench-thread';
const RESOURCE_ID = 'bench-resource';

let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function word(): string {
  const words = ['const', 'value', 'return', 'await', 'import', 'export', 'function', 'thread', 'message', 'result'];
  return words[Math.floor(rand() * words.length)]!;
}
function line(): string {
  return Array.from({ length: 4 + Math.floor(rand() * 10) }, word).join(' ');
}
function diff(bytes: number): string {
  const out: string[] = [];
  let size = 0;
  let n = 0;
  while (size < bytes) {
    const l = n % 20 === 0 ? `@@ -${n},7 +${n},8 @@` : `${['+', '-', ' '][n % 3]}  ${line()}`;
    out.push(l);
    size += l.length + 1;
    n++;
  }
  return out.join('\n');
}

function buildFixture(fixtureSeed = 42): MastraDBMessage[] {
  seed = fixtureSeed;
  const messages: MastraDBMessage[] = [];
  const start = Date.UTC(2026, 10, 17, 18, 0, 0);
  // Tool result sizes in bytes, cycling; the largest single message is about 140KB.
  const sizes = [140_000, 60_000, 30_000, 12_000, 4_000, 45_000, 2_000, 90_000, 8_000, 20_000];
  for (let i = 0; i < 90; i++) {
    const createdAt = new Date(start + i * 1000);
    if (i % 3 === 0) {
      messages.push({
        id: `m-${i}`,
        role: 'user',
        threadId: THREAD_ID,
        resourceId: RESOURCE_ID,
        createdAt,
        content: { format: 2, parts: [{ type: 'text', text: `Please continue the review. ${line()} ${line()}` }] },
      });
      continue;
    }
    const size = sizes[i % sizes.length]!;
    const isDiff = i % 2 === 0;
    messages.push({
      id: `m-${i}`,
      role: 'assistant',
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      createdAt,
      content: {
        format: 2,
        parts: [
          { type: 'step-start' },
          { type: 'text', text: `Running the next command. ${line()}` },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: `call-${i}`,
              toolName: isDiff ? 'git_diff' : 'execute_command',
              args: isDiff ? { ref: 'HEAD~1', path: `src/file-${i}.ts` } : { command: `pnpm test --filter pkg-${i}` },
              result: isDiff
                ? { diff: diff(size), files: [`src/file-${i}.ts`] }
                : { exitCode: 0, stdout: diff(size), stderr: '' },
            },
          },
          { type: 'text', text: `Done. ${line()}` },
        ],
      },
    } as MastraDBMessage);
  }
  return messages;
}

const OBSERVER_TEXT = `<observations>
## November 17, 2026

### Thread: bench-thread
- 🔴 User asked to review a pull request
- Assistant ran diffs and tests
</observations>
<current-task>Review the pull request</current-task>
<suggested-response>Continue the review.</suggested-response>`;

function streamOf(text: string) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id: 'r', modelId: 'mock', timestamp: new Date(0) },
      { type: 'text-start', id: 't' },
      { type: 'text-delta', id: 't', delta: text },
      { type: 'text-end', id: 't' },
      { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
    ] as any),
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  };
}

function mockModel(text: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('stream only');
    },
    doStream: async () => streamOf(text) as any,
  });
}

function threadCpuMs(): number {
  const { user, system } = process.threadCpuUsage();
  return (user + system) / 1000;
}

const only = process.env.OM_BENCH_ONLY;

async function measure<T>(
  label: string,
  fn: (input: T) => Promise<unknown>,
  setup: () => Promise<T> = async () => undefined as T,
): Promise<void> {
  if (only && !label.startsWith(only)) return;
  // Warm-up run so JIT state matches a long-lived process.
  await fn(await setup());
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const input = await setup();
    const before = threadCpuMs();
    await fn(input);
    samples.push(threadCpuMs() - before);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const p90 = samples[Math.floor(samples.length * 0.9)]!;
  console.log(`${label.padEnd(44)} main-thread CPU median ${median.toFixed(1)}ms  p90 ${p90.toFixed(1)}ms`);
}

async function main() {
  const fixture = buildFixture();
  const bytes = JSON.stringify(fixture).length;
  console.log(`fixture: ${fixture.length} messages, ${(bytes / 1024 / 1024).toFixed(2)}MB, ${ITERATIONS} iterations`);

  const store = new InMemoryStore();
  const memory = new Memory({
    storage: store,
    options: {
      lastMessages: false,
      observationalMemory: {
        scope: 'thread',
        observation: {
          model: mockModel(OBSERVER_TEXT),
          // Above the fixture size so steps measure recall cost without triggering observation.
          messageTokens: 5_000_000,
          bufferTokens: false,
        },
        reflection: { model: mockModel(OBSERVER_TEXT), observationTokens: 5_000_000 },
      },
    },
  });
  await memory.saveThread({
    thread: { id: THREAD_ID, resourceId: RESOURCE_ID, title: 'bench', createdAt: new Date(), updatedAt: new Date() },
  });
  // OM_BENCH_PRECOUNTED=1 stores the messages with the token estimates OM caches on parts, as messages
  // that were counted during the turn that produced them are; otherwise every message loads uncounted.
  if (process.env.OM_BENCH_PRECOUNTED) new TokenCounter().countMessages(fixture);
  await memory.saveMessages({ messages: fixture });

  const loadThread = async (threadId: string) =>
    (await (await store.getStore('memory'))!.listMessages({ threadId, perPage: false })).messages;

  const agent = new Agent({
    id: 'bench-agent',
    name: 'Bench',
    instructions: 'Review code.',
    model: mockModel('Looks good.'),
    memory,
  });

  // A full agent turn: history recall, OM input step, stubbed model call, OM/history save.
  // Messages are not persisted between iterations (readOnly) so every turn sees the same thread.
  await measure('agent turn (recall + OM step, model stubbed)', async () => {
    const result = await agent.stream('Continue.', {
      memory: { thread: THREAD_ID, resource: RESOURCE_ID, options: { readOnly: false } },
    });
    await result.consumeStream();
  });

  const engine = (await memory.omEngine)!;
  const stored = await loadThread(THREAD_ID);
  console.log(`loaded ${stored.length} messages for status`);

  await measure('OM getStatus (unobserved window count)', async () => {
    await engine.getStatus({ threadId: THREAD_ID, resourceId: RESOURCE_ID, messages: stored });
  });

  // A thread nobody has observed yet, with content no earlier thread had, loaded fresh from storage and
  // observed with the observer stubbed.
  let observeRun = 0;
  await measure(
    'OM observe (forced, observer stubbed)',
    async ({ threadId, messages }) => {
      await engine.observe({ threadId, resourceId: RESOURCE_ID, messages, force: true });
    },
    async () => {
      const threadId = `observe-${observeRun++}`;
      await memory.saveThread({
        thread: { id: threadId, resourceId: RESOURCE_ID, title: 'bench', createdAt: new Date(), updatedAt: new Date() },
      });
      await memory.saveMessages({
        // Distinct content per thread, so nothing is reused from an earlier iteration's thread.
        messages: buildFixture(1000 + observeRun).map(message => ({
          ...message,
          id: `${threadId}-${message.id}`,
          threadId,
        })),
      });
      const messages = await loadThread(threadId);
      return { threadId, messages };
    },
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
