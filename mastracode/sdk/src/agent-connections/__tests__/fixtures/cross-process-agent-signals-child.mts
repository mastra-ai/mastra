import { open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';

import { createSignalsPubSub } from '../../../utils/signals-pubsub.js';
import { createThreadOwnershipManager } from '../../ownership.js';
import { createSessionThreadAdvertisement } from '../../session-advertisement.js';

const [role, resourceIdArg, scenario = 'request-reply', startAtArg] = process.argv.slice(2);
if ((role !== 'owner' && role !== 'sender') || !resourceIdArg) {
  throw new Error('Expected role and resourceId arguments');
}
const resourceId = resourceIdArg;

const ownerThreadId = 'owner-thread';
const senderThreadId = 'sender-thread';
const transitionedSenderThreadId = 'sender-thread-2';
const contentionThreadId = 'contended-thread';
const threadId = role === 'owner' ? ownerThreadId : senderThreadId;
const peerThreadId = role === 'owner' ? senderThreadId : ownerThreadId;
const pubsub = createSignalsPubSub(resourceId);
const agent = new Agent({
  id: 'code-agent',
  name: role,
  instructions: 'Cross-process signal test',
  model: createMockModel({
    mockText: `${role}-response`,
    spyStream:
      scenario === 'simultaneous-owner-wake' ? () => emit('model-stream', { threadId: contentionThreadId }) : undefined,
  }),
  pubsub,
});

function emit(event: string, data: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ event, role, pid: process.pid, ...data })}\n`);
}

async function readRun(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  while (true) {
    const next = await iterator.next();
    if (next.done) throw new Error('Thread subscription ended before a run completed');
    const part = next.value;
    runId ??= part.runId;
    if (part.type === 'text-delta') text += part.payload.text;
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') return { runId, text };
  }
}

const commandLines = createInterface({ input: process.stdin, crlfDelay: Infinity });
const commands = commandLines[Symbol.asyncIterator]();
async function waitForCommand<T extends string>(expected: T | readonly T[]): Promise<T> {
  const accepted: readonly T[] = Array.isArray(expected) ? expected : [expected as T];
  while (true) {
    const next = await commands.next();
    if (next.done) throw new Error(`stdin closed before ${accepted.join('|')}`);
    if (accepted.includes(next.value as T)) return next.value as T;
  }
}

async function claimThread(claimThreadId: string) {
  const claim = await agent.claimThreadOwnership({
    resourceId,
    threadId: claimThreadId,
    streamOptions: { memory: { resource: resourceId, thread: claimThreadId } },
    peer: { label: `${role}:${claimThreadId}`, metadata: { pid: process.pid, role } },
  });
  if (!claim.claimed) throw new Error(`Failed to claim ${claimThreadId}`);
  return claim;
}

async function runRequestReply() {
  const subscription = await agent.subscribeToThread({ resourceId, threadId });
  const iterator = subscription.stream[Symbol.asyncIterator]();
  const claim = await claimThread(threadId);
  emit('thread-owned', { threadId });

  if (role === 'sender') {
    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const peer = peers.find(candidate => candidate.threadId === peerThreadId);
    if (!peer) throw new Error(`Did not discover ${peerThreadId}`);
    emit('discovered', { peerId: peer.id, peerThreadId: peer.threadId });

    const signal = await agent.sendSignal(
      { type: 'user-message', contents: 'cross-process request' },
      { resourceId, threadId: peerThreadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
    );
    const accepted = await signal.accepted;
    emit('send-result', { action: accepted.action, runId: 'runId' in accepted ? accepted.runId : undefined });

    const reply = await readRun(iterator);
    emit('reply', reply);
    emit('pass');
    // Stay alive until the parent confirms the owner observed its send-result.
    // Closing the pubsub here races the acceptance ack for the reply wake,
    // which would strand the owner's `accepted` promise.
    await waitForCommand('close');
  } else {
    const request = await readRun(iterator);
    emit('request', request);

    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const peer = peers.find(candidate => candidate.threadId === peerThreadId);
    if (!peer) throw new Error(`Did not discover ${peerThreadId}`);
    emit('discovered', { peerId: peer.id, peerThreadId: peer.threadId });

    const signal = await agent.sendSignal(
      { type: 'user-message', contents: 'cross-process reply' },
      { resourceId, threadId: peerThreadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
    );
    const accepted = await signal.accepted;
    emit('send-result', { action: accepted.action, runId: 'runId' in accepted ? accepted.runId : undefined });
    await waitForCommand('close');
  }

  claim.unsubscribe();
  subscription.unsubscribe();
}

async function runClaimOnly() {
  const claim = await claimThread(threadId);
  emit('thread-owned', { threadId });
  await waitForCommand('close');
  claim.unsubscribe();
}

async function runDiscoveryProbe() {
  const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
  const peer = peers.find(candidate => candidate.threadId === peerThreadId);
  emit('discovered', {
    hasPeer: Boolean(peer),
    peerId: peer?.id,
    peerThreadId: peer?.threadId,
  });
  await waitForCommand('close');
}

async function runOwnershipContention() {
  const claim = await agent.claimThreadOwnership({
    resourceId,
    threadId: contentionThreadId,
    streamOptions: { memory: { resource: resourceId, thread: contentionThreadId } },
    peer: { label: `${role}:${contentionThreadId}`, metadata: { pid: process.pid, role } },
  });
  emit('claim-result', { claimed: claim.claimed, threadId: contentionThreadId });
  await waitForCommand('close');
  claim.unsubscribe();
}

async function waitUntil(timestamp: number) {
  const delay = timestamp - Date.now();
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function runSimultaneousOwnerWake() {
  const startAt = Number(startAtArg);
  if (!Number.isFinite(startAt)) throw new Error('Expected simultaneous claim start timestamp');

  emit('ready');
  await waitUntil(startAt);

  const claim = await agent.claimThreadOwnership({
    resourceId,
    threadId: contentionThreadId,
    streamOptions: { memory: { resource: resourceId, thread: contentionThreadId } },
    peer: { label: `${role}:${contentionThreadId}`, metadata: { pid: process.pid, role } },
  });
  emit('claim-result', { claimed: claim.claimed, threadId: contentionThreadId });

  await waitForCommand('close');

  claim.unsubscribe();
}

async function runSimultaneousWakeSender() {
  const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
  const peer = peers.find(candidate => candidate.threadId === contentionThreadId);
  if (!peer) throw new Error(`Did not discover ${contentionThreadId}`);
  emit('discovered', { peerId: peer.id, peerThreadId: peer.threadId });

  const signal = await agent.sendSignal(
    { type: 'user-message', contents: 'wake exactly one simultaneous owner' },
    { resourceId, threadId: contentionThreadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
  );
  const accepted = await signal.accepted;
  emit('send-result', { action: accepted.action, runId: 'runId' in accepted ? accepted.runId : undefined });
}

async function runThreadTransition() {
  const initialSubscription = await agent.subscribeToThread({ resourceId, threadId });
  const initialIterator = initialSubscription.stream[Symbol.asyncIterator]();
  const initialClaim = await claimThread(threadId);
  emit('thread-owned', { threadId });

  if (role === 'sender') {
    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const ownerPeer = peers.find(candidate => candidate.threadId === ownerThreadId);
    if (!ownerPeer) throw new Error(`Did not discover ${ownerThreadId}`);

    const signal = await agent.sendSignal(
      { type: 'user-message', contents: 'capture my original thread' },
      { resourceId, threadId: ownerThreadId, ifIdle: { behavior: 'wake' } },
    );
    const accepted = await signal.accepted;
    emit('request-send', { action: accepted.action });

    await waitForCommand('transition');
    initialClaim.unsubscribe();
    const transitionedSubscription = await agent.subscribeToThread({
      resourceId,
      threadId: transitionedSenderThreadId,
    });
    const transitionedClaim = await claimThread(transitionedSenderThreadId);
    emit('transitioned', { fromThreadId: senderThreadId, threadId: transitionedSenderThreadId });

    const delayedReply = await readRun(initialIterator);
    emit('delayed-reply', { ...delayedReply, threadId: senderThreadId });
    await waitForCommand('prepare-close');

    transitionedClaim.unsubscribe();
    transitionedSubscription.unsubscribe();
  } else {
    const request = await readRun(initialIterator);
    emit('request', request);

    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const capturedPeer = peers.find(candidate => candidate.threadId === senderThreadId);
    if (!capturedPeer) throw new Error(`Did not discover ${senderThreadId}`);
    emit('captured-route', { peerId: capturedPeer.id, threadId: capturedPeer.threadId });

    await waitForCommand('reply');
    const transitionedPeers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    emit('transition-discovery', {
      hasOldThread: transitionedPeers.some(candidate => candidate.threadId === senderThreadId),
      hasNewThread: transitionedPeers.some(candidate => candidate.threadId === transitionedSenderThreadId),
    });

    const reply = await agent.sendSignal(
      { type: 'user-message', contents: 'delayed reply to captured thread' },
      // Deliberately omits `requireClaimedOwner` (unlike the wake signals above):
      // the sender already released `sender-thread` when it transitioned to
      // `sender-thread-2`, so requiring a claimed owner would throw
      // "No claimed thread owner responded". This scenario intentionally covers
      // the fail-open routing path.
      { resourceId, threadId: capturedPeer.threadId, ifIdle: { behavior: 'wake' } },
    );
    const accepted = await reply.accepted;
    emit('delayed-send', {
      action: accepted.action,
      targetThreadId: capturedPeer.threadId,
      runId: 'runId' in accepted ? accepted.runId : undefined,
    });
    await waitForCommand('prepare-close');
  }

  initialSubscription.unsubscribe();
  initialClaim.unsubscribe();
}

/**
 * Drives the SDK ownership manager the way `createSessionThreadAdvertisement`
 * does, with a mutable "current thread" standing in for `session.thread.getId()`.
 *
 * Owner: claims `owner-thread` as its current thread, then on `switch` moves
 * to `owner-thread-2` while keeping `owner-thread` claimed (cumulative
 * advertisement). Sender: on `claim` tries to own `owner-thread` — this must
 * lose while the owner is still looking at it, then win once the owner has
 * moved on and yields.
 */
async function runYieldOnDemand() {
  let currentThreadId = role === 'owner' ? ownerThreadId : senderThreadId;
  const manager = createThreadOwnershipManager(async (claimThreadId, { onYield }) => {
    const claim = await agent.claimThreadOwnership({
      resourceId,
      threadId: claimThreadId,
      streamOptions: { memory: { resource: resourceId, thread: claimThreadId } },
      peer: { label: `${role}:${claimThreadId}`, metadata: { pid: process.pid, role } },
      yieldOwnership: () => currentThreadId !== claimThreadId,
      onOwnershipYielded: () => {
        onYield();
        emit('yielded', { threadId: claimThreadId });
      },
    });
    // The manager retries silently; report every attempt so the test can see
    // the contender lose while the owner is on the thread and win after it yields.
    emit('claim-attempt', { threadId: claimThreadId, claimed: claim.claimed });
    return claim;
  });

  const probe = async () => {
    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    emit('discovered', {
      threads: peers
        .map(peer => ({ threadId: peer.threadId, label: peer.label, selfAdvertised: peer.selfAdvertised === true }))
        .sort((a, b) => a.threadId.localeCompare(b.threadId)),
    });
  };

  if (role === 'owner') {
    emit('claim-result', { threadId: ownerThreadId, claimed: await manager.claim(ownerThreadId) });
    for (;;) {
      const command = await waitForCommand(['switch', 'stall', 'probe', 'close']);
      if (command === 'close') break;
      if (command === 'probe') {
        await probe();
        continue;
      }
      if (command === 'stall') {
        // A live owner whose event loop hitches — rendering, GC, a busy
        // broker — stays on its thread the whole time. Block synchronously in
        // bursts with tiny gaps so the socket still flushes between them.
        const until = Date.now() + STALL_TOTAL_MS;
        const buffer = new Int32Array(new SharedArrayBuffer(4));
        while (Date.now() < until) {
          Atomics.wait(buffer, 0, 0, STALL_BURST_MS);
          await new Promise(resolve => setTimeout(resolve, STALL_GAP_MS));
        }
        emit('stalled', { threadId: currentThreadId });
        continue;
      }
      currentThreadId = 'owner-thread-2';
      emit('claim-result', { threadId: currentThreadId, claimed: await manager.claim(currentThreadId) });
      emit('switched', { threadId: currentThreadId });
    }
  } else {
    await waitForCommand('claim');
    emit('claim-result', { threadId: ownerThreadId, claimed: await manager.claim(ownerThreadId) });
    for (;;) {
      const command = await waitForCommand(['probe', 'close']);
      if (command === 'close') break;
      await probe();
    }
  }

  manager.close();
}

/** Races two processes to reclaim a filesystem lease from a killed holder. */
async function runStaleLeaseTakeover() {
  const leaseProvider = pubsub.getLeaseProvider();
  const leaseKey = 'stale-holder-race';
  if (role === 'sender') await waitUntil(Number(startAtArg));
  const result = await leaseProvider.acquireLease(leaseKey, `${role}:${process.pid}`, 15_000);
  emit('lease-result', result);
  await waitForCommand('close');
}

/** Repeatedly releases and reacquires one lease while another process does the same. */
async function runLeaseMutationHammer() {
  const leaseProvider = pubsub.getLeaseProvider();
  const leaseKey = 'mutation-lock-hammer';
  const criticalPath = join('/tmp/mc', resourceId, 'mutation-lock-hammer.critical');
  const owner = `${role}:${process.pid}`;
  let acquisitions = 0;
  let overlaps = 0;
  await waitUntil(Number(startAtArg));

  while (acquisitions < 100) {
    const lease = await leaseProvider.acquireLease(leaseKey, owner, 15_000);
    if (!lease.acquired) {
      await new Promise(resolve => setTimeout(resolve, 1));
      continue;
    }

    let criticalFile;
    try {
      criticalFile = await open(criticalPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      overlaps++;
    }
    await new Promise(resolve => setTimeout(resolve, 1));
    await criticalFile?.close();
    if (criticalFile) await unlink(criticalPath).catch(() => {});
    await leaseProvider.releaseLease(leaseKey, owner);
    acquisitions++;
  }

  emit('hammer-result', { acquisitions, overlaps });
}

/** Drives the real session advertisement closure across two processes. */
async function runSessionAdvertisementYield() {
  const controller = new AgentController({
    id: `${role}-session-advertisement-controller`,
    resourceId,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    pubsub,
  } as any);
  await controller.init();
  const session = await controller.createSession({
    id: `${role}-session-advertisement-session`,
    ownerId: role,
    resourceId,
  });
  const advertisement = createSessionThreadAdvertisement({
    session,
    controller,
    projectName: `${role}:session-advertisement`,
  });

  const claimLeaseKey = `thread-claim:${resourceId}\u0000${ownerThreadId}`;
  const probe = async () => {
    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const shared = peers.find(peer => peer.threadId === ownerThreadId);
    emit('discovered', {
      threadId: ownerThreadId,
      currentThreadId: session.thread.getId(),
      leaseOwner: await pubsub.getLeaseProvider().getLeaseOwner(claimLeaseKey),
      hasPeer: Boolean(shared),
      selfAdvertised: shared?.selfAdvertised === true,
      label: shared?.label,
    });
  };

  if (role === 'owner') {
    await session.thread.create({ id: ownerThreadId });
    while (!(await pubsub.getLeaseProvider().getLeaseOwner(claimLeaseKey))) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    emit('thread-owned', { threadId: ownerThreadId });
    for (;;) {
      const command = await waitForCommand([
        'reclaim',
        'switch-away',
        'switch-back',
        'switch-away-and-back',
        'probe',
        'close',
      ]);
      if (command === 'close') break;
      if (command === 'probe') {
        await probe();
      } else if (command === 'reclaim') {
        await advertisement.claim(ownerThreadId);
        emit('reclaimed', { threadId: ownerThreadId });
      } else if (command === 'switch-away' || command === 'switch-away-and-back') {
        await session.thread.create({ id: 'owner-thread-2' });
        emit(command === 'switch-away' ? 'switched' : 'switched-away', { threadId: session.thread.getId() });
        if (command === 'switch-away-and-back') {
          await new Promise(resolve => setTimeout(resolve, 300));
          await session.thread.switch({ threadId: ownerThreadId });
          emit('switched-back', { threadId: session.thread.getId() });
        }
      } else {
        await session.thread.switch({ threadId: ownerThreadId });
        emit('switched', { threadId: session.thread.getId() });
      }
    }
  } else {
    await waitForCommand('claim');
    await session.thread.create({ id: ownerThreadId });
    emit('claim-started', { threadId: ownerThreadId });
    for (;;) {
      const command = await waitForCommand(['switch-away', 'probe', 'close']);
      if (command === 'close') break;
      if (command === 'probe') {
        await probe();
      } else {
        await session.thread.create({ id: 'sender-thread-2' });
        emit('switched', { threadId: session.thread.getId() });
      }
    }
  }

  advertisement.close();
}

const STALL_TOTAL_MS = 6_000;
const STALL_BURST_MS = 400;
const STALL_GAP_MS = 20;

async function main() {
  if (scenario === 'thread-transition') await runThreadTransition();
  else if (scenario === 'yield-on-demand') await runYieldOnDemand();
  else if (scenario === 'session-advertisement-yield') await runSessionAdvertisementYield();
  else if (scenario === 'stale-lease-takeover') await runStaleLeaseTakeover();
  else if (scenario === 'lease-mutation-hammer') await runLeaseMutationHammer();
  else if (scenario === 'claim-only') await runClaimOnly();
  else if (scenario === 'discovery-probe') await runDiscoveryProbe();
  else if (scenario === 'ownership-contention') await runOwnershipContention();
  else if (scenario === 'simultaneous-owner-wake') await runSimultaneousOwnerWake();
  else if (scenario === 'simultaneous-wake-sender') await runSimultaneousWakeSender();
  else await runRequestReply();
  if (scenario === 'thread-transition') {
    await pubsub.flush();
    emit('close-ready');
    await waitForCommand('close');
  }
  commandLines.close();
  await pubsub.close();
}

main().catch(async error => {
  emit('fatal', { message: error instanceof Error ? error.message : String(error) });
  commandLines.close();
  await pubsub.close().catch(() => {});
  process.exitCode = 1;
});
