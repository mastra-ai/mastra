import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LLMock } from '@copilotkit/aimock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINAL_ANSWER, USER_REQUEST } from './fixtures/om-resume-peer';
import type { PeerCommand, PeerEvent, StoredState } from './fixtures/om-resume-peer';

const PEER = fileURLToPath(new URL('./fixtures/om-resume-peer.ts', import.meta.url));
const TSX = import.meta.resolve('tsx');

interface Peer {
  child: ChildProcess;
  events: PeerEvent[];
}

function next<T extends PeerEvent['type']>(
  peer: Peer,
  type: T,
  timeoutMs = 60_000,
): Promise<Extract<PeerEvent, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      peer.child.off('message', onMessage);
      reject(new Error(`timed out waiting for ${type}`));
    }, timeoutMs);
    const onMessage = (event: PeerEvent) => {
      if (event.type === 'error' || event.type === type) {
        clearTimeout(timer);
        peer.child.off('message', onMessage);
        if (event.type === 'error') reject(new Error(event.data.message));
        else resolve(event as Extract<PeerEvent, { type: T }>);
      }
    };
    peer.child.on('message', onMessage);
  });
}

const send = (peer: Peer, command: PeerCommand) => peer.child.send(command);
const shape = (state: StoredState) => state.messages.map(({ role, parts }) => ({ role, parts }));

// The shared-engine core harness creates one InMemoryStore per agent and cannot
// recover a dead process's run. Here, the actor uses AIMock over HTTP while the
// two workers share a real LibSQL file. Only durable/evented have recovery APIs.
// The fs control uses fs-agent registration, not filesystem agent assembly.
describe.each(['normal', 'durable', 'evented', 'fs'] as const)('AIMock OM request (%s)', engine => {
  let llm: LLMock;
  let dir: string;
  const peers: Peer[] = [];

  async function spawn(db: string, mode: 'normal' | 'hang') {
    const child = fork(PEER, [`file:${join(dir, db)}`, engine, mode, llm.url], {
      execArgv: ['--import', TSX],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const peer = { child, events: [] as PeerEvent[] };
    child.on('message', (event: PeerEvent) => peer.events.push(event));
    peers.push(peer);
    await next(peer, 'ready', 30_000);
    return peer;
  }

  async function dump(peer: Peer) {
    const result = next(peer, 'dump');
    send(peer, { type: 'dump' });
    return (await result).data;
  }

  function script(finalOptions?: { chunkSize: number; latency: number }) {
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: { orderId: '4471-0' } }] },
    );
    llm.on(
      { endpoint: 'chat', sequenceIndex: 1 },
      { toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { orderId: '4471-1' } }] },
    );
    llm.on(
      { endpoint: 'chat', sequenceIndex: 2 },
      { content: finalOptions ? `${FINAL_ANSWER} ${'waiting '.repeat(200)}` : FINAL_ANSWER },
      finalOptions,
    );
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'om-aimock-'));
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterEach(async () => {
    for (const { child } of peers.splice(0)) child.kill('SIGKILL');
    await llm.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('preserves the user request through mid-turn observation and persists the answer', async () => {
    script();
    const peer = await spawn('baseline.db', 'normal');
    const done = next(peer, 'done');
    send(peer, { type: 'stream' });
    expect((await done).data.text).toBe(FINAL_ANSWER);
    expect(peer.events.filter(event => event.type === 'observer').length).toBeGreaterThan(0);
    const requests = llm.getRequests();
    expect(requests).toHaveLength(3);
    for (const request of requests) expect(JSON.stringify(request.body?.messages)).toContain(USER_REQUEST);
    expect(JSON.stringify(requests[2]!.body?.messages)).toContain('call_1');
    const state = await dump(peer);
    expect(JSON.stringify(shape(state))).toContain(FINAL_ANSWER);
  }, 120_000);

  if (engine === 'durable' || engine === 'evented') {
    it('recovers a killed worker on a fresh process without losing the model request or stored output', async () => {
      script();
      const solo = await spawn('solo.db', 'normal');
      const done = next(solo, 'done');
      send(solo, { type: 'stream' });
      expect((await done).data.text).toBe(FINAL_ANSWER);
      const baseline = await dump(solo);
      llm.clearFixtures();
      llm.clearRequests();
      llm.resetMatchCounts();

      // Slow the final HTTP response: kill A only after AIMock receives the
      // third prompt, with the mid-turn snapshot already persisted.
      script({ chunkSize: 1, latency: 200 });
      const a = await spawn('shared.db', 'hang');
      send(a, { type: 'stream' });
      await expect.poll(() => llm.getRequests().length, { timeout: 30_000 }).toBe(3);
      expect(a.events.filter(event => event.type === 'observer').length).toBeGreaterThan(0);
      const runsResponse = next(a, 'runs');
      send(a, { type: 'runs' });
      const runs = (await runsResponse).data.filter(run => run.status === 'running');
      expect(runs.length).toBeGreaterThan(0);
      const beforeKill = await dump(a);
      expect(beforeKill.observedMessageIds.length).toBeGreaterThan(0);
      const exited = new Promise(resolve => a.child.once('exit', resolve));
      a.child.kill('SIGKILL');
      await exited;

      llm.clearFixtures();
      llm.resetMatchCounts();
      llm.on({ endpoint: 'chat' }, { content: FINAL_ANSWER });
      const b = await spawn('shared.db', 'normal');
      for (const { runId } of runs) {
        const lapsed = next(b, 'lapsed');
        send(b, { type: 'lapse', runId });
        await lapsed;
      }
      const recovered = next(b, 'recovered');
      send(b, { type: 'recover' });
      expect((await recovered).data).toEqual({ succeeded: 1, failed: 0 });
      await expect.poll(async () => JSON.stringify(shape(await dump(b))), { timeout: 30_000 }).toContain(FINAL_ANSWER);
      const resumed = await dump(b);
      const recoveryRequests = llm.getRequests().slice(3);
      expect(recoveryRequests.length).toBeGreaterThan(0);
      for (const request of recoveryRequests) {
        const prompt = JSON.stringify(request.body?.messages);
        expect(prompt.includes(USER_REQUEST)).toBe(true);
        expect(prompt.includes('call_1')).toBe(true);
      }
      expect(b.events.filter(event => event.type === 'observer')).toHaveLength(0);
      expect(resumed.observedMessageIds).toEqual(beforeKill.observedMessageIds);
      expect(shape(resumed)).toEqual(shape(baseline));
      expect(new Set(resumed.messages.map(message => message.id)).size).toBe(resumed.messages.length);
    }, 240_000);
  }
});
