/**
 * Measures what putting agent-controller display state on the wire costs.
 *
 * Drives one realistic turn through a real AgentController session and the real
 * STREAM_AGENT_CONTROLLER_SESSION_ROUTE handler, with N stream clients that
 * serialize every frame the way a server adapter does. Deltas are spaced past the
 * session's 16 ms coalescing window, so every delta produces one snapshot, as it
 * does when a model streams at typical token rates.
 *
 * Reports CPU time, time spent synchronously inside `session.emit` (event-loop
 * blocking) and GC as medians over --repeat runs, bytes allocated in one
 * profiled run (heap sampling profiler, including objects already collected),
 * and a hash of each client's wire bytes, so runs before and after a change can
 * be compared for both cost and output.
 *
 * Run from packages/server after building @mastra/core:
 *   pnpm tsx scripts/bench-agent-controller-stream.ts [--deltas 500] [--clients 0,1,5] [--result-kb 100] [--repeat 5] [--display-state false]
 */
import { createHash } from 'node:crypto';
import { Session as InspectorSession } from 'node:inspector/promises';
import { PerformanceObserver } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';

import { STREAM_AGENT_CONTROLLER_SESSION_ROUTE } from '../src/server/handlers/agent-controller';
import { redactStreamChunk } from '../src/server/server-adapter/redact';
import { serializeStreamChunk } from '../src/server/server-adapter/serialize';

const { values } = parseArgs({
  options: {
    deltas: { type: 'string', default: '500' },
    clients: { type: 'string', default: '0,1,5' },
    'result-kb': { type: 'string', default: '100' },
    'gap-ms': { type: 'string', default: '17' },
    repeat: { type: 'string', default: '5' },
    'display-state': { type: 'string', default: 'true' },
  },
});
const DELTAS = Number(values.deltas);
const CLIENT_COUNTS = values.clients!.split(',').map(Number);
const RESULT_BYTES = Number(values['result-kb']) * 1024;
const GAP_MS = Number(values['gap-ms']);
const REPEAT = Number(values.repeat);
const DISPLAY_STATE = values['display-state'] !== 'false';

type Client = { bytes: number; frames: number; hash: ReturnType<typeof createHash>; done: Promise<void> };

let run = 0;
const encoder = new TextEncoder();

async function openClient(mastra: Mastra, sessionId: string, abortSignal: AbortSignal): Promise<Client> {
  const stream = (await STREAM_AGENT_CONTROLLER_SESSION_ROUTE.handler({
    mastra,
    controllerId: 'code',
    sessionId,
    displayState: DISPLAY_STATE,
    abortSignal,
  } as any)) as ReadableStream<unknown>;
  const reader = stream.getReader();
  const client: Client = { bytes: 0, frames: 0, hash: createHash('sha256'), done: Promise.resolve() };
  client.done = (async () => {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      const value = next.value;
      if (typeof value === 'string') continue; // heartbeat comment
      // Mirror the server adapters: redact, serialize, frame.
      const serialized = serializeStreamChunk(redactStreamChunk(value as any));
      if (!serialized.ok) throw serialized.error;
      const frame = encoder.encode(`data: ${serialized.json}\n\n`);
      client.bytes += frame.byteLength;
      client.frames++;
      client.hash.update(frame);
    }
  })();
  return client;
}

/** One turn: text, a tool call with a large result, then more text. */
async function playTurn(target: { emit(event: any): void }, timing: { emitMs: number }) {
  const session = {
    emit(event: any) {
      const start = performance.now();
      target.emit(event);
      timing.emitMs += performance.now() - start;
    },
  };
  const messageId = 'assistant-1';
  const toolCallId = 'call-1';
  const result = { content: 'x'.repeat(RESULT_BYTES), truncated: false };
  const delta = 'lorem ipsum dolor sit amet, consectetur ';
  const half = Math.floor(DELTAS / 2);

  session.emit({ type: 'agent_start' });
  session.emit({
    type: 'message_start',
    message: {
      id: messageId,
      role: 'assistant',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      content: { format: 2, parts: [{ type: 'text', text: '' }] },
    },
  });
  for (let i = 0; i < half; i++) {
    session.emit({ type: 'message_update', id: messageId, event: { type: 'text-delta', delta } });
    await sleep(GAP_MS);
  }
  const args = { path: 'src/index.ts', query: 'needle' };
  session.emit({
    type: 'message_update',
    id: messageId,
    event: {
      type: 'part',
      index: 1,
      part: { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName: 'grep', args } },
    },
  });
  session.emit({ type: 'tool_start', toolCallId, toolName: 'grep', args });
  session.emit({ type: 'tool_end', toolCallId, result, isError: false });
  session.emit({
    type: 'message_update',
    id: messageId,
    event: {
      type: 'part',
      index: 1,
      part: {
        type: 'tool-invocation',
        toolInvocation: { state: 'result', toolCallId, toolName: 'grep', args, result },
      },
    },
  });
  session.emit({
    type: 'message_update',
    id: messageId,
    event: { type: 'part', index: 2, part: { type: 'text', text: '' } },
  });
  for (let i = half; i < DELTAS; i++) {
    session.emit({ type: 'message_update', id: messageId, event: { type: 'text-delta', delta } });
    await sleep(GAP_MS);
  }
  session.emit({ type: 'message_end', id: messageId });
  session.emit({ type: 'agent_end', reason: 'complete' });
}

async function measure(clientCount: number, profile: boolean) {
  run++;
  const storage = new InMemoryStore();
  const agent = new Agent({ id: 'bench', name: 'bench', instructions: 'bench', model: {} as any });
  const controller = new AgentController({
    id: 'code',
    storage,
    modes: [{ id: 'build', name: 'Build', default: true, agent }],
  });
  const mastra = new Mastra({ agentControllers: { code: controller }, storage, logger: false });
  await controller.init();
  const sessionId = `bench-${run}`;
  const session = await controller.createSession({ resourceId: sessionId, id: sessionId, ownerId: 'code' });

  const abort = new AbortController();
  const clients: Client[] = [];
  for (let i = 0; i < clientCount; i++) clients.push(await openClient(mastra, sessionId, abort.signal));
  await sleep(50);

  let inspector: InspectorSession | undefined;
  if (profile) {
    inspector = new InspectorSession();
    inspector.connect();
    await inspector.post('HeapProfiler.enable');
    await inspector.post('HeapProfiler.startSampling', {
      samplingInterval: 1024,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    } as any);
  }

  let gcCount = 0;
  let gcMs = 0;
  const gcObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      gcCount++;
      gcMs += entry.duration;
    }
  });
  gcObserver.observe({ entryTypes: ['gc'] });

  const timing = { emitMs: 0 };
  const cpuStart = process.cpuUsage();
  await playTurn(session, timing);
  await sleep(50); // let trailing snapshots flush and readers drain
  const cpu = process.cpuUsage(cpuStart);
  gcObserver.disconnect();

  let allocated = 0;
  let wireAllocated = 0;
  let serializeAllocated = 0;
  if (inspector) {
    const { profile: heap } = (await inspector.post('HeapProfiler.stopSampling')) as any;
    const walk = (node: any, inWire: boolean, inSerialize: boolean) => {
      const wire = inWire || /^toWire/.test(node.callFrame.functionName);
      const serialize = inSerialize || node.callFrame.functionName === 'serializeStreamChunk';
      allocated += node.selfSize;
      if (wire) wireAllocated += node.selfSize;
      if (serialize) serializeAllocated += node.selfSize;
      for (const child of node.children) walk(child, wire, serialize);
    };
    walk(heap.head, false, false);
    inspector.disconnect();
  }

  abort.abort();
  await Promise.all(clients.map(c => c.done));
  return {
    clients: clientCount,
    cpuMs: (cpu.user + cpu.system) / 1000,
    emitMs: timing.emitMs,
    gcCount,
    gcMs,
    allocatedMB: allocated / 1024 / 1024,
    wireAllocatedMB: wireAllocated / 1024 / 1024,
    serializeAllocatedMB: serializeAllocated / 1024 / 1024,
    framesPerClient: clients[0]?.frames ?? 0,
    wireMBPerClient: (clients[0]?.bytes ?? 0) / 1024 / 1024,
    wireHashes: [...new Set(clients.map(c => c.hash.digest('hex').slice(0, 16)))],
  };
}

const fmt = (n: number) => n.toFixed(1);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function main() {
  console.log(
    `deltas=${DELTAS} result=${RESULT_BYTES / 1024}KB gap=${GAP_MS}ms displayState=${DISPLAY_STATE} node=${process.version}`,
  );
  await measure(1, false); // warm up
  for (const clientCount of CLIENT_COUNTS) {
    // Profile first: once the stream path is fully optimized, inlined frames can
    // drop out of the sampled stacks and the per-function split reads zero.
    const alloc = await measure(clientCount, true);
    const runs = [];
    for (let i = 0; i < REPEAT; i++) runs.push(await measure(clientCount, false));
    const timing = {
      ...runs[0]!,
      cpuMs: median(runs.map(r => r.cpuMs)),
      emitMs: median(runs.map(r => r.emitMs)),
      gcCount: median(runs.map(r => r.gcCount)),
      gcMs: median(runs.map(r => r.gcMs)),
    };
    console.log(
      [
        `clients=${clientCount}`,
        `cpu=${fmt(timing.cpuMs)}ms`,
        `emit=${fmt(timing.emitMs)}ms`,
        `gc=${timing.gcCount}x/${fmt(timing.gcMs)}ms`,
        `allocated=${fmt(alloc.allocatedMB)}MB`,
        `toWire*=${fmt(alloc.wireAllocatedMB)}MB`,
        `serialize=${fmt(alloc.serializeAllocatedMB)}MB`,
        `frames/client=${timing.framesPerClient}`,
        `wire/client=${fmt(timing.wireMBPerClient)}MB`,
        `wireHash=${timing.wireHashes.join('|')}`,
      ].join('  '),
    );
  }
}

await main();
