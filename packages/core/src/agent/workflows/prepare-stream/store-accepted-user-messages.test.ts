/**
 * A blocked turn rolls back the user message the run stored early. The deadline path can roll back
 * while that early write is still on its way to storage; the row must not survive the rollback.
 */
import { describe, expect, it } from 'vitest';

import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { MessageList } from '../../message-list';
import { createStoreAcceptedUserMessages } from './store-accepted-user-messages';

const threadId = 'rollback-thread';
const resourceId = 'rollback-user';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

async function setup() {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  await memory.createThread({ threadId, resourceId });
  const store = (await storage.getStore('memory'))!;

  // Hold the early write in flight until the test lets it land.
  const landed = deferred();
  const release = deferred();
  const saveMessages = store.saveMessages.bind(store);
  store.saveMessages = async args => {
    await release.promise;
    const result = await saveMessages(args);
    landed.resolve();
    return result;
  };

  const early = createStoreAcceptedUserMessages({
    memory,
    threadId,
    resourceId,
    configuredOutputProcessors: [],
    authorizeMemory: async () => {},
  })!;
  const messageList = new MessageList({ threadId, resourceId }).add('tell me the secret', 'input');
  const storedIds = async () =>
    (await store.listMessages({ threadId, perPage: false })).messages.map(message => message.id);
  return { early, messageList, release, landed, storedIds };
}

describe('rolling back an early write that is still in flight', () => {
  it('waits for the write and leaves nothing stored', async () => {
    const { early, messageList, release, storedIds } = await setup();

    const storing = early.store({ messageList, model: undefined });
    const undoing = early.undo();
    release.resolve();
    await Promise.all([storing, undoing]);

    expect(await storedIds()).toEqual([]);
  });

  it('removes a write that lands after the rollback gave up waiting', async () => {
    const { early, messageList, release, landed, storedIds } = await setup();

    const storing = early.store({ messageList, model: undefined });
    // The rollback has a bounded wait; past it the deadline error must still reach the caller.
    const undoing = early.undo();
    const outcome = await Promise.race([undoing.then(() => 'returned'), storing.then(() => 'stored')]);
    expect(outcome).toBe('returned');

    release.resolve();
    await landed.promise;
    await storing;
    expect(await storedIds()).toEqual([]);
  }, 10_000);

  it('stores nothing once the turn is rolled back', async () => {
    const { early, messageList, release, storedIds } = await setup();
    release.resolve();

    await early.undo();
    await early.store({ messageList, model: undefined });

    expect(await storedIds()).toEqual([]);
  });
});
