import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ReadableStream } from 'node:stream/web';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { Agent, isAgentCompatible } from '@mastra/core/agent';
import type { SubAgent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import type { ChunkType } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod/v4';

type CapturedChunk = ChunkType | ChunkType<unknown>;
const directory = process.env.STREAM_QUAL_DELEGATION_EVIDENCE_DIR;
assert(directory, 'STREAM_QUAL_DELEGATION_EVIDENCE_DIR is required');
mkdirSync(directory, { recursive: true });
const engines = ['plain', 'durable', 'evented'] as const;
type Engine = (typeof engines)[number];
type Cell = { scenario: 'success' | 'approval' | 'decline' | 'siblings'; parent: Engine; children: Engine[] };
const pairs = engines.flatMap(child => [
  { parent: 'plain' as const, children: [child] },
  ...(child === 'plain' ? [] : [{ parent: child, children: [child] }]),
]);
const cells: Cell[] = [
  ...engines.flatMap(parent => engines.map(child => ({ scenario: 'success' as const, parent, children: [child] }))),
  ...(['approval', 'decline'] as const).flatMap(scenario => pairs.map(pair => ({ scenario, ...pair }))),
  ...engines.map((parent, index) => ({
    scenario: 'siblings' as const,
    parent,
    children: [parent, engines[(index + 1) % engines.length]!],
  })),
];
writeFileSync(`${directory}/cells.json`, JSON.stringify(cells, null, 2));
const entrypoints = [
  '@mastra/core/agent',
  '@mastra/core/agent/durable',
  '@mastra/core/mastra',
  '@mastra/libsql',
  '@mastra/memory',
];
const provenance = {
  pid: process.pid,
  node: process.version,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  diffSha256: createHash('sha256')
    .update(execFileSync('git', ['diff', 'HEAD']))
    .digest('hex'),
  fixtureSha256: createHash('sha256')
    .update(readFileSync(new URL(import.meta.url)))
    .digest('hex'),
  entrypoints: entrypoints.map(name => {
    const url = import.meta.resolve(name);
    assert(url.includes('/dist/'), `Not a built package: ${name}`);
    return {
      name,
      url,
      sha256: createHash('sha256')
        .update(readFileSync(new URL(url)))
        .digest('hex'),
    };
  }),
};
writeFileSync(`${directory}/provenance.json`, JSON.stringify(provenance, null, 2));
const results: { cell: Cell; error?: string }[] = [];
const hasTool = (request: ChatCompletionRequest, name: string) =>
  request.tools?.some(tool => tool.function.name === name) ?? false;
const hasResult = (request: ChatCompletionRequest) => request.messages.some(message => message.role === 'tool');
const text = (frames: CapturedChunk[]) =>
  frames
    .filter(frame => frame.type === 'text-delta')
    .map(frame => frame.payload.text)
    .join('');

for (const cell of cells) {
  const name = `${cell.scenario}-${cell.parent}-${cell.children.join('+')}`;
  const record = (event: string, data: unknown) =>
    appendFileSync(
      `${directory}/${name}.jsonl`,
      JSON.stringify({ event, at: new Date().toISOString(), cell, data }) + '\n',
    );
  const id = randomUUID();
  const storage = new LibSQLStore({ id: `delegation-${id}`, url: ':memory:' });
  const memory = new Memory({ storage, options: { generateTitle: false } });
  const mock = new LLMock({ port: 0 });
  const bus = new EventEmitterPubSub();
  const effects: string[] = [];
  const source: CapturedChunk[][] = cell.children.map(() => []);
  const projected: CapturedChunk[] = [];
  let mastra: Mastra | undefined;
  let error: unknown;
  record('started', { id, pid: process.pid });
  try {
    await mock.start();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url}/v1` });
    const agents: Record<string, SubAgent> = {};
    for (const [index, engine] of cell.children.entries()) {
      const key = `worker${index}`;
      const base = new Agent({
        id: `${key}-${id}`,
        name: key,
        description: key,
        instructions: 'Follow the script.',
        model: openai('gpt-4o-mini'),
        defaultOptions: {
          onChunk: chunk => {
            source[index]!.push(chunk);
            record('child-frame', { index, chunk });
          },
        },
        tools: {
          [`effect${index}`]: createTool({
            id: `effect${index}`,
            description: 'Record a protected side effect.',
            inputSchema: z.object({ value: z.literal(key) }),
            requireApproval: cell.scenario !== 'success',
            execute: async ({ value }) => {
              effects.push(value);
              record('effect', { index, value });
              return { value };
            },
          }),
        },
      });
      const wrappedChild =
        engine === 'durable'
          ? createDurableAgent({ agent: base, cleanupTimeoutMs: 0 })
          : engine === 'evented'
            ? createEventedAgent({ agent: base, pubsub: bus })
            : base;
      assert(isAgentCompatible(wrappedChild), `Unsupported child engine: ${engine}`);
      agents[key] = wrappedChild;
    }
    const base = new Agent({
      id: `supervisor-${id}`,
      name: 'Supervisor',
      instructions: 'Delegate to workers, then finish.',
      model: openai('gpt-4o-mini'),
      agents,
      memory,
    });
    const agent =
      cell.parent === 'durable'
        ? createDurableAgent({ agent: base, cleanupTimeoutMs: 0 })
        : cell.parent === 'evented'
          ? createEventedAgent({ agent: base, pubsub: bus })
          : base;
    mastra = new Mastra({ agents: { supervisor: agent, ...agents }, storage, pubsub: bus, logger: false });
    mock.on(
      { endpoint: 'chat', predicate: req => hasTool(req, 'agent-worker0') && !hasResult(req) },
      {
        toolCalls: cell.children.map((_, index) => ({
          id: `outer-${index}`,
          name: `agent-worker${index}`,
          arguments: { prompt: `Run worker${index}.` },
        })),
      },
    );
    mock.on(
      { endpoint: 'chat', predicate: req => hasTool(req, 'agent-worker0') && hasResult(req) },
      { content: 'Supervisor complete.' },
    );
    for (const index of cell.children.keys()) {
      mock.on(
        { endpoint: 'chat', predicate: req => hasTool(req, `effect${index}`) && !hasResult(req) },
        {
          toolCalls: [{ id: `inner-${index}`, name: `effect${index}`, arguments: { value: `worker${index}` } }],
        },
      );
      mock.on(
        { endpoint: 'chat', predicate: req => hasTool(req, `effect${index}`) && hasResult(req) },
        { content: `Worker${index} complete.` },
      );
    }
    const options = {
      runId: `parent-${id}`,
      memory: { thread: `thread-${id}`, resource: `resource-${id}` },
      maxSteps: 5,
      closeOnSuspend: true,
    };
    const drain = async (stream: ReadableStream<CapturedChunk>, approvalCount = 0) => {
      const reader = stream.getReader();
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        void reader.cancel();
      }, 20_000);
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          projected.push(next.value);
          record('parent-frame', next.value);
          if (approvalCount && projected.filter(chunk => chunk.type === 'tool-call-approval').length >= approvalCount)
            break;
        }
        assert(!expired, 'Reader exceeded 20000ms');
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
    };
    await drain(
      (await agent.stream('Run the workers.', { ...options, closeOnSuspend: cell.scenario !== 'siblings' })).fullStream,
      cell.scenario === 'siblings' ? cell.children.length : 0,
    );
    if (cell.scenario !== 'success') {
      assert.deepEqual(effects, []);
      assert.equal(
        projected.filter(chunk => chunk.type === 'tool-call-approval').length,
        cell.children.length,
        'Every sibling approval must reach the parent',
      );
      const entrySchema = z.object({
        runId: z.string(),
        toolCallId: z.string(),
        delegatedRunId: z.string(),
        delegatedToolCallId: z.string(),
        delegatedToolName: z.string(),
      });
      const { messages } = await memory.recall({
        threadId: options.memory.thread,
        resourceId: options.memory.resource,
      });
      const entries = [
        ...new Map(
          messages
            .flatMap(message =>
              Object.values(message.content.metadata?.pendingToolApprovals ?? {}).map(entry =>
                entrySchema.parse(entry),
              ),
            )
            .map(entry => [entry.toolCallId, entry]),
        ).values(),
      ];
      record('approval-identities', entries);
      assert.equal(entries.length, cell.children.length);
      assert.equal(new Set(entries.map(entry => entry.delegatedRunId)).size, cell.children.length);
      for (const index of cell.children.keys()) {
        const entry = entries.find(entry => entry.toolCallId === `outer-${index}`)!;
        assert.equal(entry.runId, options.runId);
        assert.notEqual(entry.delegatedRunId, entry.runId);
        assert.equal(entry.delegatedToolCallId, `inner-${index}`);
        assert.equal(entry.delegatedToolName, `effect${index}`);
        const decision = cell.scenario !== 'decline' && index === 0;
        const resumed = decision
          ? await agent.approveToolCall({ ...options, runId: entry.runId, toolCallId: entry.toolCallId })
          : await agent.declineToolCall({
              ...options,
              runId: entry.runId,
              toolCallId: entry.toolCallId,
              reason: 'Qualification denied.',
            });
        await drain(resumed.fullStream);
      }
    }
    assert.deepEqual(effects, cell.scenario === 'decline' ? [] : ['worker0']);
    assert.equal(projected.filter(chunk => chunk.type === 'finish').length, 1);
    assert.deepEqual(
      projected.filter(chunk => ['error', 'abort', 'tool-error'].includes(chunk.type)),
      [],
    );
    assert.equal(text(projected), 'Supervisor complete.');
    for (const index of cell.children.keys()) {
      assert.equal(text(source[index]!), `Worker${index} complete.`);
      assert.equal(
        mock.getRequests().filter(request => hasTool(request.body as ChatCompletionRequest, `effect${index}`)).length,
        2,
      );
      const output = projected
        .filter(chunk => chunk.type === 'tool-output')
        .filter(chunk => chunk.payload.toolCallId === `outer-${index}`);
      assert(output.length > 0);
      assert(output.every(chunk => chunk.runId === options.runId && chunk.payload.toolName === `agent-worker${index}`));
      const nested = output.map(chunk =>
        z
          .object({ type: z.string(), runId: z.string(), payload: z.looseObject({ text: z.string().optional() }) })
          .parse(chunk.payload.output),
      );
      const childRunIds = [...new Set(source[index]!.map(chunk => chunk.runId))];
      assert.equal(childRunIds.length, 1);
      assert.notEqual(childRunIds[0], options.runId);
      assert.deepEqual([...new Set(nested.map(chunk => chunk.runId))], childRunIds);
      assert.equal(nested.filter(chunk => chunk.type === 'finish').length, 1);
      assert.equal(
        nested
          .filter(chunk => chunk.type === 'text-delta')
          .map(chunk => chunk.payload.text)
          .join(''),
        `Worker${index} complete.`,
      );
      const results = projected
        .filter(chunk => chunk.type === 'tool-result')
        .filter(chunk => chunk.payload.toolCallId === `outer-${index}`);
      assert.equal(results.length, 1);
      const result = z
        .object({ subAgentThreadId: z.string(), subAgentResourceId: z.string() })
        .parse(results[0]!.payload.result);
      assert.notEqual(result.subAgentThreadId, options.memory.thread);
      record('identity', {
        parentRunId: options.runId,
        outerToolCallId: `outer-${index}`,
        childRunId: childRunIds[0],
        ...result,
      });
      for (const sibling of cell.children.keys()) {
        if (sibling !== index) assert(!source[sibling]!.some(chunk => chunk.runId === childRunIds[0]));
      }
    }
    assert.equal(
      mock.getRequests().filter(request => hasTool(request.body as ChatCompletionRequest, 'agent-worker0')).length,
      2,
    );
    record('qualified', { effects, requests: mock.getRequests() });
  } catch (caught) {
    error = caught;
    record('failure', { error: String(caught), effects, requests: mock.getRequests() });
  } finally {
    const cleanup = [
      await Promise.resolve()
        .then(() => mastra?.stopWorkers())
        .then(
          () => ({ status: 'fulfilled' }),
          reason => ({ status: 'rejected', reason: String(reason) }),
        ),
      ...(await Promise.allSettled([bus.close(), mock.stop(), storage.close()])),
    ];
    record('cleanup', cleanup);
    if (cleanup.some(result => result.status === 'rejected')) error ??= new Error('Cleanup failed');
  }
  results.push({ cell, ...(error ? { error: String(error) } : {}) });
}
writeFileSync(
  `${directory}/summary.json`,
  JSON.stringify({ expected: cells.length, executed: results.length, results }, null, 2),
);
const failures = results.filter(result => result.error);
console.log(
  `PROOF: ${failures.length ? 'BLOCKED' : 'QUALIFIED'} — built-package delegation ${results.length - failures.length}/${cells.length}; ${failures.length} unclassified failures`,
);
process.exitCode = failures.length ? 1 : 0;
