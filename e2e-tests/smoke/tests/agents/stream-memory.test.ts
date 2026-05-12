import { describe, it, expect } from 'vitest';
import { streamAgent } from '../utils.js';

describe('agent stream with memory', () => {
  it('should recall context across turns on the same thread', async () => {
    const threadId = crypto.randomUUID();
    const resourceId = 'smoke-test-stream-user';

    // First turn: introduce a fact
    const { status: firstStatus, events: firstEvents } = await streamAgent('test-agent', {
      messages: [
        {
          role: 'user',
          content: 'Remember this: the magic word is BRAVO-9. Just confirm you got it.',
        },
      ],
      memory: { thread: threadId, resource: resourceId },
    });

    expect(firstStatus).toBe(200);
    expect(firstEvents.length).toBeGreaterThan(0);

    // Verify it's a valid stream with text content
    const firstTypes = firstEvents.map((e: any) => e.type);
    expect(firstTypes).toContain('text-delta');

    // Second turn: ask about the fact on the same thread
    const { status: secondStatus, events: secondEvents } = await streamAgent('test-agent', {
      messages: [{ role: 'user', content: 'What is the magic word I told you?' }],
      memory: { thread: threadId, resource: resourceId },
    });

    expect(secondStatus).toBe(200);

    // Collect all text from second stream
    const textDeltas = secondEvents.filter((e: any) => e.type === 'text-delta');
    expect(textDeltas.length, 'expected text-delta events in stream response').toBeGreaterThan(0);

    const fullText = textDeltas.map((e: any) => e.payload.text).join('');
    expect(fullText.toUpperCase(), 'LLM did not recall the magic word from the previous turn').toContain('BRAVO-9');
  });
});
