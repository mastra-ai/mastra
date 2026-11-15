import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { serve as serveNode } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ChunkType } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { createInngestAgent, serve } from '@mastra/inngest';
import { LibSQLStore } from '@mastra/libsql';
import getPort from 'get-port';
import { Hono } from 'hono';
import { Inngest } from 'inngest';
import { z } from 'zod/v4';

const directory = process.env.STREAM_QUAL_INNGEST_EVIDENCE_DIR;
if (!directory) throw new Error('STREAM_QUAL_INNGEST_EVIDENCE_DIR is required');
mkdirSync(directory, { recursive: true });
const journalPath = join(directory, 'public.jsonl');
const journal = (event: string, data: unknown) =>
  appendFileSync(journalPath, `${JSON.stringify({ at: new Date().toISOString(), event, data })}\n`);
const require = createRequire(import.meta.url);
const binary =
  process.env.INNGEST_CLI_PATH ?? join(dirname(require.resolve('inngest-cli/package.json')), 'bin', 'inngest');
assert(existsSync(binary), 'Install the already-declared Inngest CLI explicitly before this demo');
const schedulerPort = await getPort();
const handlerPort = await getPort();
const gatewayPort = await getPort();
const connectPort = await getPort();
const executorPort = await getPort();
const baseUrl = `http://127.0.0.1:${schedulerPort}`;
const handlerUrl = `http://127.0.0.1:${handlerPort}/inngest/api`;
const mock = new LLMock({ port: 0 });
const identities: {
  functionId: string;
  orchestrationRunId: string;
  mastraRunId: string;
  eventId: string;
  eventName: string;
}[] = [];
const effects: string[] = [];
let failure: unknown;
let server: ReturnType<typeof serveNode> | undefined;
let scheduler: ReturnType<typeof spawn> | undefined;
let mastra: Mastra | undefined;
const storage = new LibSQLStore({ id: `qualification-${randomUUID()}`, url: ':memory:' });
const deadline = setTimeout(() => {
  journal('deadline', {});
  process.kill(process.pid, 'SIGTERM');
}, 90_000);
const stop = () => {
  failure ??= new Error('Qualification interrupted');
  scheduler?.kill('SIGTERM');
  if (server && 'closeAllConnections' in server) server.closeAllConnections();
  server?.close();
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

async function waitFor(check: () => Promise<void>, timeout = 15_000) {
  const end = Date.now() + timeout;
  let last: unknown;
  do {
    try {
      await check();
      return;
    } catch (error) {
      last = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < end);
  throw last;
}
async function drain(stream: ReadableStream<ChunkType>, name: string, until?: string) {
  const frames: ChunkType[] = [];
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
      frames.push(next.value);
      journal('frame', { name, frame: next.value });
      if (next.value.type === until) break;
    }
    assert(!expired, `${name}: missing bounded terminal`);
    return frames;
  } finally {
    clearTimeout(timer);
    await reader.cancel();
    reader.releaseLock();
  }
}
const wireFrames = (frames: ChunkType[]): unknown => JSON.parse(JSON.stringify(frames));
const text = (frames: ChunkType[]) =>
  frames
    .filter(frame => frame.type === 'text-delta')
    .map(frame => frame.payload.text)
    .join('');
try {
  journal('provenance', {
    pid: process.pid,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    diffSha256: createHash('sha256')
      .update(execFileSync('git', ['diff', 'HEAD']))
      .digest('hex'),
    fixtureSha256: createHash('sha256')
      .update(readFileSync(new URL(import.meta.url)))
      .digest('hex'),
    entrypointHashes: Object.fromEntries(
      ['@mastra/inngest', '@mastra/core/agent'].map(name => [
        name,
        createHash('sha256')
          .update(readFileSync(require.resolve(name)))
          .digest('hex'),
      ]),
    ),
    inngest: require.resolve('@mastra/inngest'),
    core: require.resolve('@mastra/core/agent'),
    topology: 'single-process factory-only; no shared-workflow override',
    binaryVersion: execFileSync(binary, ['version'], { encoding: 'utf8' }).trim(),
  });
  await mock.start();
  const inngest = new Inngest({ id: `qualification-${randomUUID()}`, isDev: true, baseUrl });
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url}/v1` });
  const agent = createInngestAgent({
    agent: new Agent({
      id: `qualify-${randomUUID()}`,
      name: 'Qualification',
      instructions: 'Follow the requested tool use.',
      model: openai('gpt-4o-mini'),
      tools: {
        qualifyEffect: createTool({
          id: 'qualifyEffect',
          description: 'Record an approved effect',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          execute: async ({ value }) => {
            effects.push(value);
            journal('effect', { value });
            return { value };
          },
        }),
      },
    }),
    inngest,
  });
  mastra = new Mastra({ storage, agents: { qualification: agent } });
  await mastra.startWorkers();
  const app = new Hono();
  app.all('/inngest/api', async context => {
    if (context.req.method === 'POST') {
      const body = z
        .object({
          ctx: z.object({ run_id: z.string() }),
          event: z.object({ id: z.string(), name: z.string(), data: z.object({ runId: z.string() }) }),
        })
        .parse(await context.req.raw.clone().json());
      const identity = {
        functionId: z.string().parse(context.req.query('fnId')),
        orchestrationRunId: body.ctx.run_id,
        mastraRunId: body.event.data.runId,
        eventId: body.event.id,
        eventName: body.event.name,
      };
      identities.push(identity);
      journal('invocation', identity);
    }
    return serve({ mastra: mastra!, inngest })(context);
  });
  server = serveNode({ fetch: app.fetch, hostname: '127.0.0.1', port: handlerPort });
  scheduler = spawn(
    binary,
    [
      'dev',
      '-p',
      String(schedulerPort),
      '-u',
      handlerUrl,
      '--no-discovery',
      '--poll-interval=1',
      `--connect-gateway-port=${gatewayPort}`,
      `--connect-gateway-grpc-port=${connectPort}`,
      `--connect-executor-grpc-port=${executorPort}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  scheduler.stdout?.on('data', data => appendFileSync(join(directory, 'scheduler.stdout.txt'), data));
  scheduler.stderr?.on('data', data => appendFileSync(join(directory, 'scheduler.stderr.txt'), data));
  journal('resources', {
    schedulerPid: scheduler.pid,
    ports: [schedulerPort, handlerPort, gatewayPort, connectPort, executorPort],
  });
  await waitFor(async () => {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    assert(response.ok);
  });
  await waitFor(async () => {
    await fetch(handlerUrl, { method: 'PUT', signal: AbortSignal.timeout(1000) });
    const registration = (await fetch(`${baseUrl}/dev`).then(response => response.json())) as {
      functions?: { slug: string }[];
    };
    for (const id of ['inngest:durable-agentic-loop', 'inngest:durable-agentic-execution'])
      assert(
        registration.functions?.some(fn => fn.slug.endsWith(`workflow.${id}`)),
        `Missing ${id}`,
      );
    journal('registration', registration.functions);
  });
  mock.on(
    { endpoint: 'chat' },
    { content: 'The factory stream continues after detach and replays all delivered text.' },
    { chunkSize: 2, latency: 40 },
  );
  const run = await agent.stream('Reply slowly without tools.');
  journal('run', { cell: 'reattach-replay', runId: run.runId });
  const liveDrain = drain(run.output.fullStream, 'live');
  try {
    const first = await agent.observe(run.runId);
    try {
      const prefix = await drain(first.fullStream, 'prefix', 'text-delta');
      assert(text(prefix).length > 0);
    } finally {
      first.detach();
    }
    const second = await agent.observe(run.runId, { offset: 0 });
    try {
      const [live, replay] = await Promise.all([liveDrain, drain(second.fullStream, 'reattached')]);
      assert.equal(text(live), 'The factory stream continues after detach and replays all delivered text.');
      assert.equal(text(replay), text(live));
      assert.deepEqual(wireFrames(replay), wireFrames(live));
      assert.equal(replay.filter(frame => frame.type === 'finish').length, 1);
    } finally {
      second.detach();
    }
    const completed = await agent.observe(run.runId);
    try {
      const replay = await drain(completed.fullStream, 'completed');
      assert.deepEqual(wireFrames(replay), wireFrames(await liveDrain));
      assert.equal(text(replay), 'The factory stream continues after detach and replays all delivered text.');
      assert.equal(replay.at(-1)?.type, 'finish');
    } finally {
      completed.detach();
    }
    assert.equal(mock.getRequests().length, 1);
  } finally {
    run.cleanup();
    await liveDrain;
    journal('model-requests', mock.getRequests());
  }
  mock.clearFixtures();
  mock.clearRequests();
  const toolCallId = `call-${randomUUID()}`;
  mock.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: toolCallId, name: 'qualifyEffect', arguments: { value: 'once' } }] },
  );
  mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved effect completed.' });
  const pending = await agent.stream('Record once.', { closeOnSuspend: true });
  journal('run', { cell: 'approval', runId: pending.runId, toolCallId });
  try {
    const suspended = await drain(pending.output.fullStream, 'suspended');
    assert(suspended.some(frame => frame.type === 'tool-call-approval' && frame.payload.toolCallId === toolCallId));
    assert.equal(effects.length, 0);
    const workflows = await storage.getStore('workflows');
    await waitFor(async () => {
      const snapshot = await workflows?.loadWorkflowSnapshot({
        workflowName: 'inngest:durable-agentic-loop',
        runId: pending.runId,
      });
      assert.equal(snapshot?.status, 'suspended');
      assert(Object.keys(snapshot?.resumeLabels ?? {}).includes(toolCallId));
      journal('approval-ready', { runId: pending.runId, snapshot });
    });
    const observer = await agent.observe(pending.runId);
    try {
      const resumed = await agent.approveToolCall({ runId: pending.runId, toolCallId });
      const [continuation, replay] = await Promise.all([
        drain(resumed.fullStream, 'resumed'),
        drain(observer.fullStream, 'approval-observer'),
      ]);
      assert.equal(text(continuation), 'Approved effect completed.');
      assert.equal(text(replay), text(continuation));
      assert.deepEqual(wireFrames(replay), wireFrames([...suspended, ...continuation]));
      const completed = await agent.observe(pending.runId);
      try {
        assert.deepEqual(wireFrames(await drain(completed.fullStream, 'approval-completed')), wireFrames(replay));
      } finally {
        completed.detach();
      }
      assert.equal(continuation.filter(frame => frame.type === 'finish').length, 1);
      assert.equal(replay.filter(frame => frame.type === 'finish').length, 1);
      assert(!continuation.some(frame => frame.type === 'tool-call-approval' || frame.type === 'error'));
      assert.deepEqual(effects, ['once']);
      assert.equal(mock.getRequests().length, 2);
    } finally {
      observer.detach();
    }
  } finally {
    pending.cleanup();
    journal('model-requests', mock.getRequests());
  }
  for (const runId of [run.runId, pending.runId]) {
    const joined = identities.filter(identity => identity.mastraRunId === runId);
    assert(joined.some(identity => identity.functionId.endsWith('workflow.inngest:durable-agentic-loop')));
    assert(joined.some(identity => identity.functionId.endsWith('workflow.inngest:durable-agentic-execution')));
    assert(joined.every(identity => identity.orchestrationRunId !== runId));
    journal('identity-join', {
      runId,
      modelRequests: runId === run.runId ? 1 : 2,
      toolEffects: runId === run.runId ? 0 : effects.length,
      invocations: joined,
    });
  }
  journal('assertions-passed', { effects, identities: identities.length });
} catch (error) {
  failure = error;
  journal('failure', { message: String(error), stack: error instanceof Error ? error.stack : undefined });
} finally {
  clearTimeout(deadline);
  const cleanup = await Promise.allSettled([
    (async () => {
      if (server) {
        if ('closeAllConnections' in server) server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server!.close(error => (error ? reject(error) : resolve())));
      }
    })(),
    (async () => {
      if (scheduler && scheduler.exitCode === null && scheduler.signalCode === null) {
        const exited = once(scheduler, 'exit');
        scheduler.kill('SIGTERM');
        const timer = setTimeout(() => scheduler?.kill('SIGKILL'), 3000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
        }
      }
    })(),
    (async () => {
      await mastra?.stopWorkers();
      await storage.close();
    })(),
    mock.stop(),
  ]);
  const errors = cleanup.filter(result => result.status === 'rejected').map(result => result.reason);
  journal('cleanup', {
    schedulerExit: scheduler?.exitCode,
    schedulerSignal: scheduler?.signalCode,
    results: cleanup.map(result => result.status),
  });
  if (errors.length) {
    journal('cleanup-error', errors.map(String));
    failure = new AggregateError(failure ? [failure, ...errors] : errors);
  }
  process.removeListener('SIGTERM', stop);
  process.removeListener('SIGINT', stop);
}
if (failure) {
  console.error('PROOF: BLOCKED — built factory qualification failed', failure);
  process.exitCode = 1;
} else console.log('PROOF: QUALIFIED — built Inngest factory replay, reattachment and approval controls');
