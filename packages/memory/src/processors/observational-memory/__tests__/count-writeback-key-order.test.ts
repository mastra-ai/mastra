import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const estimate = { v: 8, source: 'part', tokens: 123 };

function message(parts: any[]): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    threadId: 't',
    resourceId: 'r',
    createdAt: new Date('2026-01-01'),
    content: { format: 2, parts },
  };
}

async function setup() {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: 't', resourceId: 'r', createdAt: new Date(), updatedAt: new Date(), metadata: {} },
  });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'test-model', messageTokens: 1_000_000_000, bufferTokens: false, bufferOnIdle: false },
    reflection: { model: 'test-model', observationTokens: 1_000_000_000 },
  });
  return { storage, om };
}

const storedEstimate = async (storage: InMemoryMemory) => {
  const { messages } = await storage.listMessagesById({ messageIds: ['assistant-1'] });
  return (messages[0]!.content.parts[0] as any).providerMetadata?.mastra?.tokenEstimate;
};

describe('writing token counts back onto stored history', () => {
  it('matches a stored part whose object keys came back in a different order', async () => {
    const { storage, om } = await setup();
    // A store such as Postgres jsonb returns keys in its own order.
    const storedPart = { type: 'tool-result', output: { b: 2, a: 1 }, toolCallId: 'c1' };
    await storage.saveMessages({ messages: [message([storedPart])] });

    const livePart = { toolCallId: 'c1', type: 'tool-result', output: { a: 1, b: 2 } };
    const counted = message([{ ...livePart, providerMetadata: { mastra: { tokenEstimate: estimate } } }]);
    await om.persistMessages([counted], 't', 'r', new Set(['assistant-1']));

    expect(await storedEstimate(storage)).toEqual(estimate);
  });

  it('still refuses a stored part whose content changed', async () => {
    const { storage, om } = await setup();
    await storage.saveMessages({ messages: [message([{ type: 'text', text: 'edited in storage' }])] });

    const counted = message([{ type: 'text', text: 'what OM counted', providerMetadata: { mastra: { tokenEstimate: estimate } } }]);
    await om.persistMessages([counted], 't', 'r', new Set(['assistant-1']));

    expect(await storedEstimate(storage)).toBeUndefined();
  });
});
