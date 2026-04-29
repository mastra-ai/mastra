import { describe, expect, it } from 'vitest';
import { EXECUTE_PROCESSOR_ROUTE } from './processors';

const message = {
  id: 'message-1',
  role: 'user' as const,
  content: {
    format: 2,
    parts: [{ type: 'text', text: 'hello' }],
  },
};

describe('processor handlers', () => {
  it('should reject processor results with both messages and modelContextMessages', async () => {
    const processor = {
      id: 'invalid-processor',
      processInput: () => ({
        messages: [message],
        modelContextMessages: [message],
      }),
    };

    const mastra = {
      getProcessorById: () => processor,
      listProcessors: () => ({ [processor.id]: processor }),
    };

    await expect(
      EXECUTE_PROCESSOR_ROUTE.handler({
        mastra,
        processorId: processor.id,
        phase: 'input',
        messages: [message],
      } as never),
    ).rejects.toThrow('returned both messages and modelContextMessages');
  });
});
