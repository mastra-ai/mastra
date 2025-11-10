import { describe, it, expect } from 'vitest';
import transformer from '../codemods/v1/client-get-memory-thread';
import { testTransform, applyTransform } from './test-utils';

describe('client-get-memory-thread', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'client-get-memory-thread');
  });

  it('does not transform getMemoryThread on non-client instances', () => {
    const input = `
const someObject = { getMemoryThread: () => {} };
const thread = someObject.getMemoryThread(threadId, agentId);
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });

  it('does not transform getMemoryThread with wrong number of arguments', () => {
    const input = `
import { MastraClient } from '@mastra/client-js';
const client = new MastraClient({ baseUrl: 'http://localhost' });

// Already using object syntax - should not be transformed
const thread1 = await client.getMemoryThread({ threadId, agentId });

// Only one argument - should not be transformed
const thread2 = await client.getMemoryThread(threadId);

// Three arguments - should not be transformed
const thread3 = await client.getMemoryThread(threadId, agentId, extra);
    `.trim();

    const output = applyTransform(transformer, input);

    // Should remain unchanged
    expect(output).toBe(input);
  });
});
