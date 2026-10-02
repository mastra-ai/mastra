import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import { Agent } from '../../../agent';
import { MessageList } from '../../../message-list';
import type { MastraDBMessage } from '../../../message-list';
import {
  createStoredMessageLoader,
  isMemoryMessageRef,
  MemoryMessageRefs,
} from '../../../message-list/memory-message-refs';
import { globalRunRegistry } from '../../run-registry';
import { readMessageListState } from './message-list-state';

describe('readMessageListState', () => {
  it("restores recalled messages through the agent's memory in a process without the run's registry entry", async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    await memory.createThread({ threadId: 't', resourceId: 'r' });
    const rows: MastraDBMessage[] = [
      {
        id: 'h1',
        threadId: 't',
        resourceId: 'r',
        role: 'user',
        createdAt: new Date(1000),
        content: { format: 2, parts: [{ type: 'text', text: 'earlier question' }] },
      },
    ];
    await memory.saveMessages({ messages: rows });
    const agent = new Agent({ id: 'agent', name: 'agent', instructions: '', model: new MockLanguageModelV2(), memory });
    const mastra = new Mastra({ agents: { agent }, storage, logger: false });

    const load = createStoredMessageLoader(memory);
    const list = new MessageList({ threadId: 't', resourceId: 'r' });
    list.add((await load(['h1']))!, 'memory');
    list.add('new input', 'input');
    const transcript = list.serialize();
    const refs = new MemoryMessageRefs();
    await refs.verify(transcript, load);
    const stored = refs.dehydrate(transcript);
    expect(stored.messages.filter(isMemoryMessageRef)).toHaveLength(1);

    const runId = 'run-from-another-process';
    expect(globalRunRegistry.get(runId)).toBeUndefined();
    const restored = await readMessageListState(
      { state: { messageListState: stored }, getInitData: () => ({ runId, agentId: 'agent' }), mastra },
      {},
    );
    expect(restored).toEqual(transcript);
  });
});
