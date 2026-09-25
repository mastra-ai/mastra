import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const tsxBin = fileURLToPath(new URL('../../../node_modules/.bin/tsx', import.meta.url));
const childScript = fileURLToPath(new URL('./fixtures/cross-process-agent-signals-child.mts', import.meta.url));
const activeChildren = new Set<ReturnType<typeof spawn>>();

type ChildEvent = {
  event: string;
  role: 'owner' | 'sender';
  pid: number;
  [key: string]: unknown;
};

function startChild(role: 'owner' | 'sender', resourceId: string, scenario = 'request-reply', args: string[] = []) {
  const child = spawn(tsxBin, [childScript, role, resourceId, scenario, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
  activeChildren.add(child);
  child.once('close', () => activeChildren.delete(child));
  const events: ChildEvent[] = [];
  const waiters = new Map<string, Array<(event: ChildEvent) => void>>();
  let stdout = '';
  let stderr = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    const lines = stdout.split('\n');
    stdout = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line) as ChildEvent;
      events.push(event);
      for (const resolve of waiters.get(event.event) ?? []) resolve(event);
      waiters.delete(event.event);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  return {
    child,
    events,
    get stderr() {
      return stderr;
    },
    waitFor(eventName: string, timeoutMs = 10_000) {
      const existing = events.find(event => event.event === eventName);
      if (existing) return Promise.resolve(existing);
      return new Promise<ChildEvent>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for ${role}:${eventName}. Events: ${JSON.stringify(events)}. stderr: ${stderr}`,
            ),
          );
        }, timeoutMs);
        const resolveWithCleanup = (event: ChildEvent) => {
          clearTimeout(timeout);
          resolve(event);
        };
        waiters.set(eventName, [...(waiters.get(eventName) ?? []), resolveWithCleanup]);
      });
    },
    result: new Promise<number | null>(resolve => child.on('close', resolve)),
  };
}

async function waitForChildEvent(
  children: Array<ReturnType<typeof startChild>>,
  eventName: string,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const event = children.flatMap(child => child.events).find(candidate => candidate.event === eventName);
    if (event) return event;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for ${eventName}. Events: ${JSON.stringify(children.flatMap(child => child.events))}. stderr: ${children.map(child => child.stderr).join('\n')}`,
  );
}

describe.skipIf(process.platform === 'win32')('cross-agent signals over Unix sockets', () => {
  const resourceId = `agent-signals-${randomUUID().slice(0, 8)}`;
  const socketDir = `/tmp/mc/${resourceId}`;

  afterEach(async () => {
    await Promise.all(
      [...activeChildren].map(
        child =>
          new Promise<void>((resolve, reject) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            const timeout = setTimeout(
              () => reject(new Error(`Child process ${child.pid ?? 'unknown'} did not exit after SIGKILL`)),
              1_000,
            );
            child.once('close', () => {
              clearTimeout(timeout);
              resolve();
            });
            child.kill('SIGKILL');
          }),
      ),
    );
    activeChildren.clear();
    rmSync(socketDir, { recursive: true, force: true });
  });

  it('discovers thread peers and completes a request/reply across processes', async () => {
    const owner = startChild('owner', resourceId);
    await owner.waitFor('thread-owned');

    const sender = startChild('sender', resourceId);
    const senderOwned = await sender.waitFor('thread-owned');
    const senderDiscovery = await sender.waitFor('discovered');
    const ownerRequest = await owner.waitFor('request');
    const ownerDiscovery = await owner.waitFor('discovered');
    const ownerSend = await owner.waitFor('send-result');
    const senderSend = await sender.waitFor('send-result');
    const senderReply = await sender.waitFor('reply');
    await sender.waitFor('pass');

    expect(existsSync(socketDir)).toBe(true);
    expect(readdirSync(socketDir).some(name => name.endsWith('.sock'))).toBe(true);

    owner.child.stdin.write('close\n');
    owner.child.stdin.end();
    sender.child.stdin.write('close\n');
    sender.child.stdin.end();
    const [ownerCode, senderCode] = await Promise.all([owner.result, sender.result]);

    expect(owner.child.pid).not.toBe(sender.child.pid);
    expect(senderOwned.threadId).toBe('sender-thread');
    expect(senderDiscovery.peerThreadId).toBe('owner-thread');
    expect(ownerDiscovery.peerThreadId).toBe('sender-thread');
    expect(ownerRequest.text).toBe('owner-response');
    expect(senderReply.text).toBe('sender-response');
    expect(senderSend.action).toBe('deliver');
    expect(ownerSend.action).toBe('deliver');
    expect(owner.stderr).toBe('');
    expect(sender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(senderCode).toBe(0);

    expect(existsSync(socketDir)).toBe(true);
    const leftoverSockets = readdirSync(socketDir).filter(name => name.endsWith('.sock'));
    expect(leftoverSockets).toEqual([]);
  }, 30_000);

  it('releases old ownership while delayed replies keep their captured thread destination', async () => {
    const owner = startChild('owner', resourceId, 'thread-transition');
    await owner.waitFor('thread-owned');

    const sender = startChild('sender', resourceId, 'thread-transition');
    await sender.waitFor('thread-owned');
    await sender.waitFor('request-send');
    const capturedRoute = await owner.waitFor('captured-route');

    sender.child.stdin.write('transition\n');
    const transitioned = await sender.waitFor('transitioned');
    owner.child.stdin.write('reply\n');

    const transitionDiscovery = await owner.waitFor('transition-discovery');
    const delayedSend = await owner.waitFor('delayed-send');
    const delayedReply = await sender.waitFor('delayed-reply');

    owner.child.stdin.write('prepare-close\n');
    sender.child.stdin.write('prepare-close\n');
    await Promise.all([owner.waitFor('close-ready'), sender.waitFor('close-ready')]);
    owner.child.stdin.write('close\n');
    sender.child.stdin.write('close\n');
    owner.child.stdin.end();
    sender.child.stdin.end();
    const [ownerCode, senderCode] = await Promise.all([owner.result, sender.result]);

    expect(capturedRoute.threadId).toBe('sender-thread');
    expect(transitioned).toMatchObject({ fromThreadId: 'sender-thread', threadId: 'sender-thread-2' });
    expect(transitionDiscovery).toMatchObject({ hasOldThread: false, hasNewThread: true });
    expect(delayedSend.targetThreadId).toBe('sender-thread');
    expect(delayedReply).toMatchObject({ threadId: 'sender-thread', text: 'owner-response' });
    expect(owner.stderr).toBe('');
    expect(sender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(senderCode).toBe(0);

    expect(existsSync(socketDir)).toBe(true);
    const leftoverSockets = readdirSync(socketDir).filter(name => name.endsWith('.sock'));
    expect(leftoverSockets).toEqual([]);
  }, 30_000);

  it('isolates discovery between resource socket namespaces', async () => {
    const isolatedResourceId = `${resourceId}-isolated`;
    const owner = startChild('owner', resourceId, 'claim-only');
    await owner.waitFor('thread-owned');

    const observer = startChild('sender', isolatedResourceId, 'discovery-probe');
    const discovery = await observer.waitFor('discovered');

    owner.child.stdin.write('close\n');
    observer.child.stdin.write('close\n');
    owner.child.stdin.end();
    observer.child.stdin.end();
    const [ownerCode, observerCode] = await Promise.all([owner.result, observer.result]);

    expect(discovery).toMatchObject({ hasPeer: false });
    expect(owner.stderr).toBe('');
    expect(observer.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(observerCode).toBe(0);
    rmSync(`/tmp/mc/${isolatedResourceId}`, { recursive: true, force: true });
  }, 30_000);

  it('allows exactly one process to claim ownership of a thread', async () => {
    const owner = startChild('owner', resourceId, 'ownership-contention');
    const ownerClaim = await owner.waitFor('claim-result');

    const contender = startChild('sender', resourceId, 'ownership-contention');
    const contenderClaim = await contender.waitFor('claim-result');

    owner.child.stdin.write('close\n');
    contender.child.stdin.write('close\n');
    owner.child.stdin.end();
    contender.child.stdin.end();
    const [ownerCode, contenderCode] = await Promise.all([owner.result, contender.result]);

    expect(ownerClaim).toMatchObject({ claimed: true, threadId: 'contended-thread' });
    expect(contenderClaim).toMatchObject({ claimed: false, threadId: 'contended-thread' });
    expect(owner.stderr).toBe('');
    expect(contender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(contenderCode).toBe(0);
  }, 30_000);

  it('yields a thread to another process once its owner has moved on, but never the current one', async () => {
    const owner = startChild('owner', resourceId, 'yield-on-demand');
    expect(await owner.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: true });

    // The owner is still looking at owner-thread: the contender must lose and
    // keep retrying instead of taking the thread.
    const contender = startChild('sender', resourceId, 'yield-on-demand');
    contender.child.stdin.write('claim\n');
    expect(await contender.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: false });
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(owner.events.filter(event => event.event === 'yielded')).toEqual([]);
    const contenderAttempts = () => contender.events.filter(event => event.event === 'claim-attempt');
    expect(contenderAttempts().length).toBeGreaterThan(1);
    expect(contenderAttempts().every(event => event.claimed === false)).toBe(true);

    // The owner moves to another thread while keeping owner-thread claimed. The
    // contender's retry loop now asks again and the owner yields.
    owner.child.stdin.write('switch\n');
    await owner.waitFor('switched');
    const yielded = await owner.waitFor('yielded');
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && !contenderAttempts().some(event => event.claimed === true)) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    const attemptOutcomes = contenderAttempts().map(event => event.claimed);

    owner.child.stdin.write('probe\n');
    const discovery = await owner.waitFor('discovered');

    owner.child.stdin.write('close\n');
    contender.child.stdin.write('close\n');
    owner.child.stdin.end();
    contender.child.stdin.end();
    const [ownerCode, contenderCode] = await Promise.all([owner.result, contender.result]);

    expect(yielded).toMatchObject({ threadId: 'owner-thread' });
    // Every attempt lost until the owner yielded; the retry after that won.
    expect(attemptOutcomes.at(-1)).toBe(true);
    expect(attemptOutcomes.slice(0, -1).every(claimed => claimed === false)).toBe(true);
    // From the owner's side owner-thread now belongs to the contender while
    // owner-thread-2 (its current thread) is still its own.
    expect(discovery.threads).toEqual([
      { threadId: 'owner-thread', label: 'sender:owner-thread', selfAdvertised: false },
      { threadId: 'owner-thread-2', label: 'owner:owner-thread-2', selfAdvertised: true },
    ]);
    expect(owner.stderr).toBe('');
    expect(contender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(contenderCode).toBe(0);
  }, 30_000);

  it('uses the live session thread to keep, yield, and reclaim an advertised thread across processes', async () => {
    const owner = startChild('owner', resourceId, 'session-advertisement-yield');
    await owner.waitFor('thread-owned');

    const contender = startChild('sender', resourceId, 'session-advertisement-yield');
    contender.child.stdin.write('claim\n');
    await contender.waitFor('claim-started');

    const probe = async (child: ReturnType<typeof startChild>) => {
      const previousCount = child.events.filter(event => event.event === 'discovered').length;
      child.child.stdin.write('probe\n');
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const discoveries = child.events.filter(event => event.event === 'discovered');
        if (discoveries.length > previousCount) return discoveries.at(-1)!;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Timed out probing session advertisement. Events: ${JSON.stringify(child.events)}`);
    };

    // The current owner refuses to yield, so the contender still discovers it
    // as a remote peer instead of hiding the thread as its own claim.
    const initialDiscovery = await probe(contender);
    expect(
      initialDiscovery,
      JSON.stringify({ initialDiscovery, ownerEvents: owner.events, contenderEvents: contender.events }),
    ).toMatchObject({
      hasPeer: true,
      selfAdvertised: false,
    });

    // Re-claiming the current thread replaces its advertisement without first
    // dropping the live lease, so the waiting contender cannot slip in.
    owner.child.stdin.write('reclaim\n');
    await owner.waitFor('reclaimed');
    expect(await probe(contender)).toMatchObject({ hasPeer: true, selfAdvertised: false });

    // Once the owner moves away, the contender's retry atomically receives the
    // claim. The original owner now sees the shared thread as remote.
    owner.child.stdin.write('switch-away\n');
    await owner.waitFor('switched');
    await expect
      .poll(() => probe(owner), { timeout: 10_000, interval: 250 })
      .toMatchObject({
        hasPeer: true,
        selfAdvertised: false,
        label: 'sender:session-advertisement',
      });

    // Switching back cannot steal a current claim from the contender.
    owner.child.stdin.write('switch-back\n');
    await owner.waitFor('switched');
    expect(await probe(owner)).toMatchObject({ hasPeer: true, selfAdvertised: false });

    // After the contender moves on, the original session's retry reclaims the
    // shared thread and discovery hides it as self-advertised again.
    contender.child.stdin.write('switch-away\n');
    await contender.waitFor('switched');
    await expect
      .poll(() => probe(owner), { timeout: 10_000, interval: 250 })
      .toMatchObject({
        hasPeer: true,
        selfAdvertised: true,
        label: 'owner:session-advertisement',
      });

    owner.child.stdin.write('close\n');
    contender.child.stdin.write('close\n');
    owner.child.stdin.end();
    contender.child.stdin.end();
    const [ownerCode, contenderCode] = await Promise.all([owner.result, contender.result]);

    expect(owner.stderr).toBe('');
    expect(contender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(contenderCode).toBe(0);
  }, 40_000);

  it('keeps exactly one claim when an owner yields and switches back 300 ms later', async () => {
    const owner = startChild('owner', resourceId, 'session-advertisement-yield');
    await owner.waitFor('thread-owned');
    const contender = startChild('sender', resourceId, 'session-advertisement-yield');
    contender.child.stdin.write('claim\n');
    await contender.waitFor('claim-started');

    const probe = async (child: ReturnType<typeof startChild>) => {
      const previousCount = child.events.filter(event => event.event === 'discovered').length;
      child.child.stdin.write('probe\n');
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const discoveries = child.events.filter(event => event.event === 'discovered');
        if (discoveries.length > previousCount) return discoveries.at(-1)!;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Timed out probing ownership race. Events: ${JSON.stringify(child.events)}`);
    };

    owner.child.stdin.write('switch-away-and-back\n');
    await owner.waitFor('switched-away');
    await owner.waitFor('switched-back');
    const [ownerDiscovery, contenderDiscovery] = await Promise.all([probe(owner), probe(contender)]);

    expect(ownerDiscovery.leaseOwner).toBe(contenderDiscovery.leaseOwner);
    expect([ownerDiscovery.selfAdvertised, contenderDiscovery.selfAdvertised].filter(Boolean)).toHaveLength(1);

    owner.child.stdin.write('close\n');
    contender.child.stdin.write('close\n');
    owner.child.stdin.end();
    contender.child.stdin.end();
    const [ownerCode, contenderCode] = await Promise.all([owner.result, contender.result]);
    expect(owner.stderr).toBe('');
    expect(contender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(contenderCode).toBe(0);
  }, 30_000);

  it('never lets a contender take a thread from a live owner that is merely slow to answer', async () => {
    const owner = startChild('owner', resourceId, 'yield-on-demand');
    expect(await owner.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: true });

    const contender = startChild('sender', resourceId, 'yield-on-demand');
    contender.child.stdin.write('claim\n');
    expect(await contender.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: false });

    // The owner never leaves owner-thread; its event loop just hitches in
    // bursts longer than the discovery window while the contender keeps
    // retrying. Silence from a live owner must not read as "no owner".
    owner.child.stdin.write('stall\n');
    await owner.waitFor('stalled', 15_000);
    // Let a couple more retries land against a responsive owner too.
    await new Promise(resolve => setTimeout(resolve, 1_500));

    contender.child.stdin.write('probe\n');
    const discovery = await contender.waitFor('discovered');

    owner.child.stdin.write('close\n');
    contender.child.stdin.write('close\n');
    owner.child.stdin.end();
    contender.child.stdin.end();
    const [ownerCode, contenderCode] = await Promise.all([owner.result, contender.result]);

    const attempts = contender.events.filter(event => event.event === 'claim-attempt');
    // The retry loop stops on the first win, so a `true` here means the
    // contender took the thread from a live owner that never left it.
    expect(attempts.map(event => event.claimed)).toEqual(attempts.map(() => false));
    expect(attempts.length).toBeGreaterThan(2);
    expect(owner.events.filter(event => event.event === 'yielded')).toEqual([]);
    // From the contender's side owner-thread is still somebody else's, so it
    // is listed as a real peer rather than hidden as its own claim.
    expect(discovery.threads).toEqual([
      { threadId: 'owner-thread', label: 'owner:owner-thread', selfAdvertised: false },
    ]);
    expect(owner.stderr).toBe('');
    expect(contender.stderr).toBe('');
    expect(ownerCode).toBe(0);
    expect(contenderCode).toBe(0);
  }, 40_000);

  it('lets a contender take a thread once its owner has died', async () => {
    const owner = startChild('owner', resourceId, 'yield-on-demand');
    expect(await owner.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: true });

    const contender = startChild('sender', resourceId, 'yield-on-demand');
    contender.child.stdin.write('claim\n');
    expect(await contender.waitFor('claim-result')).toMatchObject({ threadId: 'owner-thread', claimed: false });

    owner.child.kill('SIGKILL');
    await owner.result;

    const contenderAttempts = () => contender.events.filter(event => event.event === 'claim-attempt');
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && !contenderAttempts().some(event => event.claimed === true)) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    contender.child.stdin.write('probe\n');
    const discovery = await contender.waitFor('discovered');

    contender.child.stdin.write('close\n');
    contender.child.stdin.end();
    const contenderCode = await contender.result;

    expect(contenderAttempts().at(-1)).toMatchObject({ claimed: true });
    expect(discovery.threads).toEqual([
      { threadId: 'owner-thread', label: 'sender:owner-thread', selfAdvertised: true },
    ]);
    expect(contender.stderr).toBe('');
    expect(contenderCode).toBe(0);
  }, 40_000);

  it('lets exactly one contender reclaim a filesystem lease from a killed holder', async () => {
    const holder = startChild('owner', resourceId, 'stale-lease-takeover');
    expect(await holder.waitFor('lease-result')).toMatchObject({ acquired: true });
    holder.child.kill('SIGKILL');
    await holder.result;

    const startAt = String(Date.now() + 2_000);
    const first = startChild('sender', resourceId, 'stale-lease-takeover', [startAt]);
    const second = startChild('sender', resourceId, 'stale-lease-takeover', [startAt]);
    const [firstResult, secondResult] = await Promise.all([
      first.waitFor('lease-result'),
      second.waitFor('lease-result'),
    ]);

    first.child.stdin.write('close\n');
    second.child.stdin.write('close\n');
    first.child.stdin.end();
    second.child.stdin.end();
    const [firstCode, secondCode] = await Promise.all([first.result, second.result]);

    expect([firstResult.acquired, secondResult.acquired].filter(Boolean)).toHaveLength(1);
    const winner = firstResult.acquired ? firstResult.owner : secondResult.owner;
    const loser = firstResult.acquired ? secondResult : firstResult;
    expect(loser).toMatchObject({ acquired: false, owner: winner });
    expect(first.stderr).toBe('');
    expect(second.stderr).toBe('');
    expect(firstCode).toBe(0);
    expect(secondCode).toBe(0);
  }, 30_000);

  it('serializes repeated cross-process lease release and reacquisition', async () => {
    const startAt = String(Date.now() + 2_000);
    const first = startChild('owner', resourceId, 'lease-mutation-hammer', [startAt]);
    const second = startChild('sender', resourceId, 'lease-mutation-hammer', [startAt]);
    const [firstResult, secondResult] = await Promise.all([
      first.waitFor('hammer-result', 30_000),
      second.waitFor('hammer-result', 30_000),
    ]);
    const [firstCode, secondCode] = await Promise.all([first.result, second.result]);

    expect(firstResult).toMatchObject({ acquisitions: 100, overlaps: 0 });
    expect(secondResult).toMatchObject({ acquisitions: 100, overlaps: 0 });
    expect(first.stderr).toBe('');
    expect(second.stderr).toBe('');
    expect(firstCode).toBe(0);
    expect(secondCode).toBe(0);
  }, 40_000);

  it('fences simultaneous process claims so exactly one owner accepts an idle wake', async () => {
    const startAt = String(Date.now() + 3_000);
    const firstOwner = startChild('owner', resourceId, 'simultaneous-owner-wake', [startAt]);
    const secondOwner = startChild('sender', resourceId, 'simultaneous-owner-wake', [startAt]);
    await Promise.all([firstOwner.waitFor('ready'), secondOwner.waitFor('ready')]);

    const [firstClaim, secondClaim] = await Promise.all([
      firstOwner.waitFor('claim-result'),
      secondOwner.waitFor('claim-result'),
    ]);
    const wakeSender = startChild('sender', resourceId, 'simultaneous-wake-sender');
    const sendResult = await wakeSender.waitFor('send-result');
    await waitForChildEvent([firstOwner, secondOwner], 'model-stream');
    await new Promise(resolve => setTimeout(resolve, 500));
    const modelStreams = [...firstOwner.events, ...secondOwner.events].filter(event => event.event === 'model-stream');

    firstOwner.child.stdin.write('close\n');
    secondOwner.child.stdin.write('close\n');
    firstOwner.child.stdin.end();
    secondOwner.child.stdin.end();
    const [firstCode, secondCode, senderCode] = await Promise.all([
      firstOwner.result,
      secondOwner.result,
      wakeSender.result,
    ]);

    expect([firstClaim.claimed, secondClaim.claimed].filter(Boolean)).toHaveLength(1);
    expect(sendResult.action).toBe('deliver');
    if (modelStreams.length !== 1) {
      throw new Error(
        `Model stream count ${modelStreams.length}. First stderr: ${firstOwner.stderr}. Second stderr: ${secondOwner.stderr}`,
      );
    }
    expect(firstOwner.stderr).toBe('');
    expect(secondOwner.stderr).toBe('');
    expect(wakeSender.stderr).toBe('');
    expect(firstCode).toBe(0);
    expect(secondCode).toBe(0);
    expect(senderCode).toBe(0);
  }, 30_000);

  it('stops advertising a thread after its owner process exits abruptly', async () => {
    const owner = startChild('owner', resourceId, 'claim-only');
    await owner.waitFor('thread-owned');

    const before = startChild('sender', resourceId, 'discovery-probe');
    const beforeDiscovery = await before.waitFor('discovered');
    before.child.stdin.write('close\n');
    before.child.stdin.end();
    expect(await before.result).toBe(0);

    owner.child.kill('SIGKILL');
    expect(await owner.result).not.toBe(0);

    const after = startChild('sender', resourceId, 'discovery-probe');
    const afterDiscovery = await after.waitFor('discovered');
    after.child.stdin.write('close\n');
    after.child.stdin.end();
    expect(await after.result).toBe(0);

    expect(beforeDiscovery).toMatchObject({ hasPeer: true, peerThreadId: 'owner-thread' });
    expect(afterDiscovery).toMatchObject({ hasPeer: false });
    expect(before.stderr).toBe('');
    expect(after.stderr).toBe('');
  }, 30_000);
});
