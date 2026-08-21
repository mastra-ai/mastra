import { createInterface } from 'node:readline';

import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';

import { createSignalsPubSub } from '../../../utils/signals-pubsub.js';

const [role, resourceIdArg, scenario = 'request-reply'] = process.argv.slice(2);
if ((role !== 'owner' && role !== 'sender') || !resourceIdArg) {
  throw new Error('Expected role and resourceId arguments');
}
const resourceId = resourceIdArg;

const ownerThreadId = 'owner-thread';
const senderThreadId = 'sender-thread';
const transitionedSenderThreadId = 'sender-thread-2';
const threadId = role === 'owner' ? ownerThreadId : senderThreadId;
const peerThreadId = role === 'owner' ? senderThreadId : ownerThreadId;
const pubsub = createSignalsPubSub(resourceId);
const agent = new Agent({
  id: 'code-agent',
  name: role,
  instructions: 'Cross-process signal test',
  model: createMockModel({ mockText: `${role}-response` }),
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
async function waitForCommand(expected: string) {
  while (true) {
    const next = await commands.next();
    if (next.done) throw new Error(`stdin closed before ${expected}`);
    if (next.value === expected) return;
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
      { resourceId, threadId: peerThreadId, ifIdle: { behavior: 'wake' } },
    );
    const accepted = await signal.accepted;
    emit('send-result', { action: accepted.action, runId: 'runId' in accepted ? accepted.runId : undefined });

    const reply = await readRun(iterator);
    emit('reply', reply);
    emit('pass');
  } else {
    const request = await readRun(iterator);
    emit('request', request);

    const peers = await agent.discoverThreadPeers({ timeoutMs: 1_000 });
    const peer = peers.find(candidate => candidate.threadId === peerThreadId);
    if (!peer) throw new Error(`Did not discover ${peerThreadId}`);
    emit('discovered', { peerId: peer.id, peerThreadId: peer.threadId });

    const signal = await agent.sendSignal(
      { type: 'user-message', contents: 'cross-process reply' },
      { resourceId, threadId: peerThreadId, ifIdle: { behavior: 'wake' } },
    );
    const accepted = await signal.accepted;
    emit('send-result', { action: accepted.action, runId: 'runId' in accepted ? accepted.runId : undefined });
    await waitForCommand('close');
  }

  claim.unsubscribe();
  subscription.unsubscribe();
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
    await waitForCommand('close');

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
      { resourceId, threadId: capturedPeer.threadId, ifIdle: { behavior: 'wake' } },
    );
    const accepted = await reply.accepted;
    emit('delayed-send', {
      action: accepted.action,
      targetThreadId: capturedPeer.threadId,
      runId: 'runId' in accepted ? accepted.runId : undefined,
    });
    await waitForCommand('close');
  }

  initialSubscription.unsubscribe();
  initialClaim.unsubscribe();
}

async function main() {
  if (scenario === 'thread-transition') await runThreadTransition();
  else await runRequestReply();
  commandLines.close();
  await pubsub.close();
}

main().catch(async error => {
  emit('fatal', { message: error instanceof Error ? error.message : String(error) });
  await pubsub.close().catch(() => {});
  process.exitCode = 1;
});
