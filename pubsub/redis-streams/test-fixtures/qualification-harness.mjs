import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { RedisStreamsPubSub } from '@mastra/redis-streams';
import { createClient } from 'redis';

// Resolve the SDK owned by core, rather than claiming a transitive fixture dependency.
const { createOpenAI } = createRequire(import.meta.resolve('@mastra/core'))('@ai-sdk/openai-v5');
const prefix = `stream-qualification-public:${randomUUID()}`;
const url = 'redis://127.0.0.1:6381';
const llm = new LLMock({ port: 0 });
const admin = createClient({ url });
admin.on('error', error => journal('redis-error', { message: error.message }));
/** @param {string} type @param {object} data */
function journal(type, data) {
  console.log(JSON.stringify({ type, at: new Date().toISOString(), pid: process.pid, ...data }));
}
/** @param {AsyncIterable<unknown>} stream @param {string} reader */
async function drain(stream, reader) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const collect = async () => {
    const frames = [];
    for await (const frame of stream) {
      frames.push(frame);
      journal('frame', { reader, frame });
    }
    return frames;
  };
  /** @type {Promise<never>} */
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Reader deadline: ${reader}`)), 15_000);
  });
  try {
    return await Promise.race([collect(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
/** @param {unknown[]} frames */
function text(frames) {
  return frames.filter(frame => typeof frame === 'object' && frame !== null && 'type' in frame && frame.type === 'text-delta')
    .map(frame => {
      assert(frame && typeof frame === 'object' && 'payload' in frame);
      const payload = frame.payload;
      assert(payload && typeof payload === 'object' && 'text' in payload);
      return payload.text;
    }).join('');
}

const deadline = setTimeout(() => {
  journal('deadline', { prefix, memory: process.memoryUsage() });
  process.exitCode = 1;
  process.emit('SIGTERM');
}, 60_000);
/** @type {Mastra | undefined} */
let active;
/** @type {RedisStreamsPubSub | undefined} */
let activeTransport;
let interrupted = false;
const interrupt = () => {
  interrupted = true;
  void active?.shutdown({ drainTimeout: 1000 });
};
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  const built = ['@mastra/core/agent', '@mastra/core/agent/durable', '@mastra/libsql', '@mastra/redis-streams'].map(specifier => {
    const file = import.meta.resolve(specifier);
    assert(file.includes('/dist/'), `Not a built package: ${file}`);
    return { specifier, file, sha256: createHash('sha256').update(readFileSync(new URL(file))).digest('hex') };
  });
  journal('provenance', {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    diffSha256: createHash('sha256').update(execFileSync('git', ['diff'])).digest('hex'),
    built, prefix, backend: 'redis', cache: 'InMemoryServerCache',
    scope: 'Public-built stream and completed replay control, not cache outage or restart qualification',
    expectedCells: ['plain', 'durable', 'evented'],
  });
  await admin.connect();
  journal('service', { pong: await admin.ping(), info: await admin.info('server') });
  await llm.start();
  for (const engine of ['plain', 'durable', 'evented']) {
    assert(!interrupted, 'Interrupted');
    const runId = randomUUID();
    let modelRequests = 0;
    const expected = `Public ${engine} stream completed.`;
    llm.on({ endpoint: 'chat', predicate: body => JSON.stringify(body).includes(runId) },
      { content: expected }, { latency: 100, chunkSize: 4 });
    const model = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1`,
      fetch: (/** @type {Parameters<typeof fetch>[0]} */ input, /** @type {Parameters<typeof fetch>[1]} */ init) => {
        journal('model-request', { engine, runId, request: ++modelRequests });
        return fetch(input, init);
      } });
    activeTransport = new RedisStreamsPubSub({ url, keyPrefix: `${prefix}:${engine}`, blockMs: 100 });
    let stepDispatches = 0;
    const publish = activeTransport.publish.bind(activeTransport);
    activeTransport.publish = async (topic, event, options) => {
      if (event.type === 'workflow.step.run') stepDispatches++;
      journal('transport-publish', { engine, runId, topic, event });
      return publish(topic, event, options);
    };
    const base = new Agent({ id: `public-${engine}`, name: 'Public stream qualification',
      instructions: 'Return the scripted answer.', model: model('gpt-4o-mini') });
    const agent = engine === 'plain' ? base : engine === 'durable'
      ? createDurableAgent({ agent: base, cleanupTimeoutMs: 0 }) : createEventedAgent({ agent: base });
    active = new Mastra({ logger: false, storage: new LibSQLStore({ id: `public-${engine}`, url: ':memory:' }),
      cache: new InMemoryServerCache(), pubsub: activeTransport, agents: { subject: agent } });
    const subject = active.getAgent('subject');
    journal('cell-start', { engine, runId, memory: process.memoryUsage() });
    const output = await subject.stream(`Answer for ${runId}`, { runId });
    const live = await drain(output.fullStream, `${engine}/live`);
    assert.equal(text(live), expected);
    assert.equal(live.filter(frame => frame !== null && typeof frame === 'object' && 'type' in frame && frame.type === 'finish').length, 1);
    if (engine !== 'plain') {
      const replay = await subject.observe(runId, { offset: 0 });
      try {
        const frames = await drain(replay.fullStream, `${engine}/replay`);
        assert.equal(text(frames), expected);
        assert.equal(frames.filter(frame => frame !== null && typeof frame === 'object' && 'type' in frame && frame.type === 'finish').length, 1);
      } finally {
        replay.detach();
      }
    }
    assert.equal(modelRequests, 1, 'Replay must not invoke the model again');
    if (engine === 'evented') assert(stepDispatches > 0, 'Evented must dispatch workflow steps through the real transport');
    else assert.equal(stepDispatches, 0, 'Non-evented control must not dispatch evented workflow steps');
    journal('cell-end', { engine, runId, modelRequests, stepDispatches, toolEffects: 0, memory: process.memoryUsage() });
    await active.shutdown({ drainTimeout: 1000 });
    active = undefined;
    await activeTransport.close();
    activeTransport = undefined;
  }
} catch (error) {
  process.exitCode = 1;
  journal('failure', { message: error instanceof Error ? error.stack : String(error) });
} finally {
  clearTimeout(deadline);
  try {
    await active?.shutdown({ drainTimeout: 1000 });
    await activeTransport?.close();
    if (admin.isOpen) {
      for await (const keys of admin.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        if (keys.length) await admin.del(keys);
      }
      for await (const keys of admin.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) assert.equal(keys.length, 0);
      await admin.quit();
    }
    await llm.stop();
    journal('cleanup', { prefix, complete: true });
  } catch (error) {
    process.exitCode = 1;
    journal('cleanup-failed', { message: String(error) });
  }
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
}
if (interrupted) process.exitCode = 1;
console.log(process.exitCode ? 'PROOF: BLOCKED — public stream/replay control failed; inspect the raw journal'
  : 'PROOF: QUALIFIED — public built-package stream/replay controls; no outage or restart claim');
