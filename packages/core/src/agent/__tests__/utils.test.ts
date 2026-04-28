import { describe, expect, it } from 'vitest';
import { resolveThreadIdFromArgs } from '../utils';

describe('resolveThreadIdFromArgs', () => {
  describe('basic behavior', () => {
    it('returns undefined when no arguments provided', () => {
      expect(resolveThreadIdFromArgs({})).toBeUndefined();
    });

    it('returns { id } when memory.thread is a string', () => {
      expect(resolveThreadIdFromArgs({ memory: { thread: 'thread-123' } })).toEqual({ id: 'thread-123' });
    });

    it('returns the full object when memory.thread is an object', () => {
      const thread = { id: 'thread-123', title: 'My Thread', metadata: { key: 'value' } };
      expect(resolveThreadIdFromArgs({ memory: { thread } })).toEqual(thread);
    });

    it('returns { id } when only threadId is provided', () => {
      expect(resolveThreadIdFromArgs({ threadId: 'thread-456' })).toEqual({ id: 'thread-456' });
    });

    it('prioritizes memory.thread over threadId', () => {
      expect(
        resolveThreadIdFromArgs({
          memory: { thread: 'from-memory' },
          threadId: 'from-threadId',
        }),
      ).toEqual({ id: 'from-memory' });
    });
  });

  describe('overrideId behavior', () => {
    it('returns { id: overrideId } when only overrideId is provided', () => {
      expect(resolveThreadIdFromArgs({ overrideId: 'override-123' })).toEqual({ id: 'override-123' });
    });

    it('overrides id when memory.thread is a string', () => {
      expect(
        resolveThreadIdFromArgs({
          memory: { thread: 'original-id' },
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id' });
    });

    it('preserves metadata when overriding id from thread object', () => {
      const thread = { id: 'original-id', title: 'My Thread', metadata: { key: 'value' } };
      expect(
        resolveThreadIdFromArgs({
          memory: { thread },
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id', title: 'My Thread', metadata: { key: 'value' } });
    });

    it('overrides id when threadId is provided', () => {
      expect(
        resolveThreadIdFromArgs({
          threadId: 'original-id',
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id' });
    });
  });
});
