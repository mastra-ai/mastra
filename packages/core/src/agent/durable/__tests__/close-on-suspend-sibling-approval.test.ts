/**
 * #28479 on the in-process transports. See the shared suite for the scenario.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { defineSiblingApprovalSuite } from './close-on-suspend-sibling-approval.suite';

defineSiblingApprovalSuite('EventEmitterPubSub', {
  createPubSub: () => new EventEmitterPubSub(),
});

const socketDirs: string[] = [];
defineSiblingApprovalSuite('UnixSocketPubSub', {
  async createPubSub() {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-28479-'));
    socketDirs.push(dir);
    return new UnixSocketPubSub(join(dir, 'pubsub.sock'));
  },
  async cleanup() {
    await Promise.all(socketDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  },
});
