import { describe, expect, it, vi } from 'vitest';

import { handleChatStream } from '../chat-route';

describe('handleChatStream client credential headers', () => {
  it('drops credential headers from client modelSettings but keeps other headers', async () => {
    const agent = {
      stream: vi.fn().mockResolvedValue({ fullStream: new ReadableStream({ start: c => c.close() }) }),
    };
    const mastra = { getAgentById: vi.fn().mockReturnValue(agent) };

    await handleChatStream({
      mastra: mastra as never,
      agentId: 'test-agent',
      params: {
        messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        modelSettings: {
          temperature: 0.2,
          headers: { Authorization: 'Bearer app-user-token', 'X-Api-Key': 'leak', 'x-trace-id': 'trace-1' },
        },
      } as never,
    });

    const options = agent.stream.mock.calls[0]![1];
    expect(options.modelSettings).toEqual({ temperature: 0.2, headers: { 'x-trace-id': 'trace-1' } });
  });
});
