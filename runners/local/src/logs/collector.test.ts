import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogCollector } from './collector';

describe('LogCollector', () => {
  let collector: LogCollector;

  beforeEach(() => {
    collector = new LogCollector(100);
  });

  describe('append', () => {
    it('should append single log lines', () => {
      collector.append('line 1');
      collector.append('line 2');

      expect(collector.getAll()).toBe('line 1\nline 2');
    });

    it('should append multiple lines at once', () => {
      collector.appendMultiple(['line 1', 'line 2', 'line 3']);

      expect(collector.getAll()).toBe('line 1\nline 2\nline 3');
    });
  });

  describe('getAll', () => {
    it('should return empty string for empty collector', () => {
      expect(collector.getAll()).toBe('');
    });

    it('should return all lines joined by newlines', () => {
      collector.append('first');
      collector.append('second');
      collector.append('third');

      expect(collector.getAll()).toBe('first\nsecond\nthird');
    });
  });

  describe('getTail', () => {
    it('should return last n lines', () => {
      collector.appendMultiple(['1', '2', '3', '4', '5']);

      expect(collector.getTail(3)).toBe('3\n4\n5');
      expect(collector.getTail(1)).toBe('5');
    });

    it('should return all lines if n is greater than line count', () => {
      collector.append('only line');

      expect(collector.getTail(100)).toBe('only line');
    });
  });

  describe('getSince', () => {
    it('should return logs since a timestamp', async () => {
      collector.append('before');

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      const since = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));

      collector.append('after 1');
      collector.append('after 2');

      const result = collector.getSince(since);
      expect(result).toBe('after 1\nafter 2');
    });

    it('should return empty string if no logs since timestamp', () => {
      collector.append('before');

      const future = new Date(Date.now() + 10000);
      expect(collector.getSince(future)).toBe('');
    });
  });

  describe('stream', () => {
    it('should stream new lines to callback', () => {
      const callback = vi.fn();
      const cleanup = collector.stream(callback);

      collector.append('line 1');
      collector.append('line 2');

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'line 1');
      expect(callback).toHaveBeenNthCalledWith(2, 'line 2');

      cleanup();
    });

    it('should stop streaming after cleanup', () => {
      const callback = vi.fn();
      const cleanup = collector.stream(callback);

      collector.append('line 1');
      cleanup();
      collector.append('line 2');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('line 1');
    });

    it('should support multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const cleanup1 = collector.stream(callback1);
      const cleanup2 = collector.stream(callback2);

      collector.append('line');

      expect(callback1).toHaveBeenCalledWith('line');
      expect(callback2).toHaveBeenCalledWith('line');

      cleanup1();
      cleanup2();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = vi.fn();

      collector.stream(errorCallback);
      collector.stream(goodCallback);

      // Should not throw
      expect(() => collector.append('line')).not.toThrow();

      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalledWith('line');
    });
  });

  describe('clear', () => {
    it('should clear all logs', () => {
      collector.appendMultiple(['1', '2', '3']);
      expect(collector.getLineCount()).toBe(3);

      collector.clear();
      expect(collector.getLineCount()).toBe(0);
      expect(collector.getAll()).toBe('');
    });
  });

  describe('getLineCount', () => {
    it('should return correct line count', () => {
      expect(collector.getLineCount()).toBe(0);

      collector.append('line');
      expect(collector.getLineCount()).toBe(1);

      collector.appendMultiple(['a', 'b', 'c']);
      expect(collector.getLineCount()).toBe(4);
    });
  });

  describe('capacity', () => {
    it('should respect max lines limit', () => {
      const smallCollector = new LogCollector(5);

      for (let i = 1; i <= 10; i++) {
        smallCollector.append(`line ${i}`);
      }

      expect(smallCollector.getLineCount()).toBe(5);
      expect(smallCollector.getAll()).toBe('line 6\nline 7\nline 8\nline 9\nline 10');
    });
  });
});
