/**
 * Child process for the PeerBus multi-process integration test.
 *
 * Spawned twice (roles: `bob` then `alice`) by peer-bus.integration.test.ts.
 * The two processes communicate ONLY over real Unix sockets via
 * SignalsPubSub — no shared memory. Progress is reported on stdout with
 * `<role>:<marker>` lines and a final `<role>:PASS`; any stall exits 1.
 */
import { PeerBus } from '../../peer-bus.js';
import type { PeerMessage } from '../../peer-bus.js';
import { createSignalsPubSub } from '../../signals-pubsub.js';

const role = process.argv[2];
if (role !== 'alice' && role !== 'bob') {
  console.error(`usage: peer-bus-child.mts <alice|bob>`);
  process.exit(2);
}
const resourceId = process.env.PEER_TEST_RESOURCE_ID;
if (!resourceId) {
  console.error('PEER_TEST_RESOURCE_ID is required');
  process.exit(2);
}

const say = (marker: string) => console.log(`${role}:${marker}`);

const watchdog = setTimeout(() => {
  console.error(`${role}:FAIL timed out`);
  process.exit(1);
}, 10_000);

const pubsub = createSignalsPubSub(resourceId);
const bus = new PeerBus({
  pubsub,
  self: {
    instanceId: role,
    pid: process.pid,
    cwd: process.cwd(),
    branch: `${role}-branch`,
  },
  heartbeatMs: 200,
});

function nextMessage(predicate: (message: PeerMessage) => boolean): Promise<PeerMessage> {
  return new Promise(resolve => {
    const unsubscribe = bus.onMessage(message => {
      if (!predicate(message)) return;
      unsubscribe();
      resolve(message);
    });
  });
}

async function waitForPeer(instanceId: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (bus.listPeers().some(peer => peer.instanceId === instanceId)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`never discovered peer ${instanceId}`);
}

async function main(): Promise<void> {
  await bus.start();

  if (role === 'bob') {
    const direct = await nextMessage(message => message.to === 'bob');
    if (direct.body !== 'hello bob, this is alice') throw new Error(`unexpected direct body: ${direct.body}`);
    say('got-direct');
    await bus.send('alice', `ack: ${direct.body}`, { replyTo: direct.id });
    const broadcast = await nextMessage(message => message.to === 'broadcast');
    if (broadcast.body !== 'all done, thanks') throw new Error(`unexpected broadcast body: ${broadcast.body}`);
    say('got-broadcast');
  } else {
    await waitForPeer('bob');
    say('discovered-bob');
    const replyPromise = nextMessage(message => message.replyTo !== undefined);
    const sent = await bus.send('bob', 'hello bob, this is alice');
    const reply = await replyPromise;
    if (reply.replyTo !== sent.id) throw new Error(`replyTo mismatch: ${reply.replyTo} !== ${sent.id}`);
    say('got-reply');
    await bus.send('broadcast', 'all done, thanks');
    // Give the broadcast time to reach bob before tearing down (alice may
    // not own the broker socket, but don't race our own publish flush).
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  await bus.stop();
  await pubsub.close();
  say('PASS');
  clearTimeout(watchdog);
  process.exit(0);
}

main().catch(error => {
  console.error(`${role}:FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
