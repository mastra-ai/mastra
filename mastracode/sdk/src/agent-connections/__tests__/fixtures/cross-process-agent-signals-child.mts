import { createInterface } from 'node:readline';

import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';

import { createSignalsPubSub } from '../../../utils/signals-pubsub.js';

const [role, resourceIdArg] = process.argv.slice(2);
if ((role !== 'owner' && role !== 'sender') || !resourceIdArg) {
  throw new Error('Expected role and resourceId arguments');
}
const resourceId = resourceIdArg;

const ownerThreadId = 'owner-thread';
const senderThreadId = 'sender-thread';
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

async function waitForCloseCommand() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line === 'close') return;
  }
}

async function main() {
  const subscription = await agent.subscribeToThread({ resourceId, threadId });
  const iterator = subscription.stream[Symbol.asyncIterator]();
  const claim = await agent.claimThreadOwnership({
    resourceId,
    threadId,
    streamOptions: { memory: { resource: resourceId, thread: threadId } },
    peer: { label: role, metadata: { pid: process.pid, role } },
  });
  if (!claim.claimed) throw new Error(`Failed to claim ${threadId}`);
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
    await waitForCloseCommand();
  }

  claim.unsubscribe();
  subscription.unsubscribe();
  await pubsub.close();
}

main().catch(async error => {
  emit('fatal', { message: error instanceof Error ? error.message : String(error) });
  await pubsub.close().catch(() => {});
  process.exitCode = 1;
});
