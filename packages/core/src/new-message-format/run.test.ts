import { MockLanguageModelV4 } from '@internal/ai-v7/test';
import { describe, expect, it } from 'vitest';
import { runAgent } from './run';
import { InMemoryActionStorage } from './storage';
import type { MastraAction } from './types';

describe('runAgent', () => {
  describe('when the provider fails the request', () => {
    it('stores the error and still ends the run', async () => {
      const memory = new InMemoryActionStorage();
      const model = new MockLanguageModelV4({
        doStream: async () => {
          throw new Error('The model `gpt-does-not-exist` does not exist');
        },
      });

      const streamed: MastraAction[] = [];
      for await (const action of runAgent({ model, input: 'Hello', threadId: 't1', memory })) streamed.push(action);

      expect(streamed.map(a => a.type)).toEqual(['run-start', 'text', 'error', 'run-end']);
      expect(streamed.at(-1)).toMatchObject({ type: 'run-end', finishReason: 'error' });
      const stored = await memory.listActions({ threadId: 't1' });
      expect(stored.map(a => a.type)).toEqual(['run-start', 'text', 'error', 'run-end']);
    });
  });
});
