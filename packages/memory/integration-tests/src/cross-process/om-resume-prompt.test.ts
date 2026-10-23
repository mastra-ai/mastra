/**
 * #27614: a durable agent with Observational Memory observes mid-turn, its
 * worker is SIGKILLed while the final model call is in flight, and a fresh
 * process recovers the run from the shared LibSQL file.
 *
 * Recovery finishes the turn without a second observation, retains the current
 * request, and stores the same messages as a single-process run.
 */
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FINAL_ANSWER } from './fixtures/om-resume-peer';
import type { ActorCall, PeerCommand, PeerEvent, StoredState } from './fixtures/om-resume-peer';

const PEER = fileURLToPath(new URL('./fixtures/om-resume-peer.ts', import.meta.url));
const TSX = import.meta.resolve('tsx');

interface Peer {
  child: ChildProcess;
  events: PeerEvent[];
}

function next<T extends PeerEvent['type']>(
  peer: Peer,
  type: T,
  until = (_e: Extract<PeerEvent, { type: T }>) => true,
  timeoutMs = 60_000,
): Promise<Extract<PeerEvent, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      peer.child.off('message', onMessage);
      reject(new Error(`timed out waiting for "${type}"`));
    }, timeoutMs);
    const onMessage = (e: PeerEvent) => {
      if (e.type === 'error') {
        clearTimeout(timer);
        peer.child.off('message', onMessage);
        reject(new Error(`peer error: ${e.data.message}`));
      } else if (e.type === type && until(e as Extract<PeerEvent, { type: T }>)) {
        clearTimeout(timer);
        peer.child.off('message', onMessage);
        resolve(e as Extract<PeerEvent, { type: T }>);
      }
    };
    peer.child.on('message', onMessage);
  });
}

const send = (peer: Peer, cmd: PeerCommand) => peer.child.send(cmd);
const actorCalls = (peer: Peer) =>
  peer.events.filter((e): e is Extract<PeerEvent, { type: 'actor' }> => e.type === 'actor').map(e => e.data);
const observerCalls = (peer: Peer) => peer.events.filter(e => e.type === 'observer').length;
const shape = (s: StoredState) => s.messages.map(({ role, parts }) => ({ role, parts }));

describe.each(['durable', 'evented'] as const)('OM in-flight turn recovered by another worker (%s)', engine => {
  let dir: string;
  const peers: Peer[] = [];

  let solo: { actor: ActorCall[]; state: StoredState; text: string };
  let beforeKill: StoredState;
  let workerAObserved: number;
  let recovered: { succeeded: number; failed: number };
  let resumed: { actor: ActorCall[]; observer: number; state: StoredState };

  async function spawn(db: string, mode: 'hang' | 'normal'): Promise<Peer> {
    const child = fork(PEER, [`file:${join(dir, db)}`, engine, mode], {
      execArgv: ['--import', TSX],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const peer = { child, events: [] as PeerEvent[] };
    child.on('message', (e: PeerEvent) => peer.events.push(e));
    peers.push(peer);
    await next(peer, 'ready', undefined, 30_000);
    return peer;
  }

  async function dump(peer: Peer) {
    send(peer, { type: 'dump' });
    return (await next(peer, 'dump')).data;
  }

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'om-resume-'));

    const soloPeer = await spawn('solo.db', 'normal');
    send(soloPeer, { type: 'stream' });
    const done = await next(soloPeer, 'done');
    solo = { actor: actorCalls(soloPeer), state: await dump(soloPeer), text: done.data.text };

    // Worker A observes mid-turn, then dies while the final model call is in flight.
    const a = await spawn('shared.db', 'hang');
    send(a, { type: 'stream' });
    await next(a, 'actor', e => e.data.final);
    workerAObserved = observerCalls(a);
    send(a, { type: 'runs' });
    const runs = (await next(a, 'runs')).data.filter(r => r.status === 'running');
    beforeKill = await dump(a);
    const exited = new Promise(resolve => a.child.once('exit', resolve));
    a.child.kill('SIGKILL');
    await exited;

    // Worker B: a fresh process on the same file recovers the run.
    const b = await spawn('shared.db', 'normal');
    for (const { runId } of runs) {
      send(b, { type: 'lapse', runId });
      await next(b, 'lapsed');
    }
    send(b, { type: 'recover' });
    recovered = (await next(b, 'recovered')).data;
    // Recovery resolves once the run is restarted; wait for the final answer to be stored.
    let state = await dump(b);
    for (let i = 0; i < 50 && !JSON.stringify(state.messages).includes(FINAL_ANSWER); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      state = await dump(b);
    }
    resumed = { actor: actorCalls(b), observer: observerCalls(b), state };
  }, 240_000);

  afterAll(async () => {
    for (const { child } of peers.splice(0)) child.kill('SIGKILL');
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('keeps the user request in every single-process request (baseline)', () => {
    expect(solo.text).toBe(FINAL_ANSWER);
    expect(solo.actor.length).toBe(3);
    expect(solo.actor.every(call => call.hasUserRequest)).toBe(true);
  });

  it('observes mid-turn in worker A and recovers the run in worker B', () => {
    expect(workerAObserved).toBeGreaterThanOrEqual(1);
    expect(beforeKill.observedMessageIds.length).toBeGreaterThanOrEqual(1);
    expect(recovered).toEqual({ succeeded: 1, failed: 0 });
    expect(resumed.actor.at(-1)).toMatchObject({ lastTool: 'call_1', final: true });
  });

  it('does not observe again on recovery', () => {
    expect(resumed.observer).toBe(0);
    expect(resumed.state.observedMessageIds).toEqual(beforeKill.observedMessageIds);
  });

  it('stores the same messages as the single-process run', () => {
    expect(shape(resumed.state)).toEqual(shape(solo.state));
    expect(new Set(resumed.state.messages.map(m => m.id)).size).toBe(resumed.state.messages.length);
  });

  it('keeps the user request in the resumed prompt', () => {
    expect(resumed.actor.length).toBeGreaterThanOrEqual(1);
    for (const call of resumed.actor) {
      expect(call.hasUserRequest).toBe(true);
    }
  });
});
