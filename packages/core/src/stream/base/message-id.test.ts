import { describe, expect, it } from 'vitest';
import { withChunkMessageId } from './message-id';

describe('withChunkMessageId', () => {
  const signalChunk = { type: 'data-user-message', data: { id: 'sig-1' } };

  it('stamps a signal chunk with its own signal id by default', () => {
    expect(withChunkMessageId(signalChunk, 'msg-1').messageId).toBe('sig-1');
  });

  it('stamps a signal-typed part saved into the response message with the response id', () => {
    expect(withChunkMessageId(signalChunk, 'msg-1', { savedInResponse: true }).messageId).toBe('msg-1');
  });
});
