import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, it, expect } from 'vitest';

import {
  stripThreadTags,
  getMaxMessageTimestamp,
  replaceOrAppendThreadSection,
  sortThreadsByOldestMessage,
  combineObservationsForBuffering,
} from '../thread-utils';

function createMsg(id: string, createdAt?: Date): MastraDBMessage {
  return {
    id,
    threadId: 'thread-1',
    role: 'user',
    type: 'text',
    content: { type: 'text', parts: [{ type: 'text', text: `msg-${id}` }] },
    createdAt,
    resourceId: 'user-1',
  } as MastraDBMessage;
}

describe('thread-utils', () => {
  describe('stripThreadTags', () => {
    it('should remove <thread> open tags', () => {
      expect(stripThreadTags('<thread id="abc">content</thread>')).toBe('content');
    });

    it('should remove tags case-insensitively', () => {
      expect(stripThreadTags('<THREAD id="abc">content</THREAD>')).toBe('content');
    });

    it('should handle no thread tags', () => {
      expect(stripThreadTags('plain content')).toBe('plain content');
    });

    it('should handle multiple thread tags', () => {
      const input = '<thread id="a">one</thread> <thread id="b">two</thread>';
      expect(stripThreadTags(input)).toBe('one two');
    });

    it('should handle empty string', () => {
      expect(stripThreadTags('')).toBe('');
    });

    it('should trim whitespace after stripping', () => {
      expect(stripThreadTags('  <thread id="x"> content </thread>  ')).toBe('content');
    });
  });

  describe('getMaxMessageTimestamp', () => {
    it('should return the most recent timestamp', () => {
      const t1 = new Date('2025-01-01');
      const t2 = new Date('2025-06-15');
      const t3 = new Date('2025-03-10');
      const result = getMaxMessageTimestamp([createMsg('1', t1), createMsg('2', t2), createMsg('3', t3)]);
      expect(result.getTime()).toBe(t2.getTime());
    });

    it('should fall back to current time when no timestamps', () => {
      const before = Date.now();
      const result = getMaxMessageTimestamp([createMsg('1'), createMsg('2')]);
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle empty array', () => {
      const before = Date.now();
      const result = getMaxMessageTimestamp([]);
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('should skip messages without createdAt', () => {
      const t1 = new Date('2025-01-01');
      const result = getMaxMessageTimestamp([createMsg('1', t1), createMsg('2')]);
      expect(result.getTime()).toBe(t1.getTime());
    });

    it('should handle single message', () => {
      const t = new Date('2025-05-20');
      const result = getMaxMessageTimestamp([createMsg('1', t)]);
      expect(result.getTime()).toBe(t.getTime());
    });
  });

  describe('replaceOrAppendThreadSection', () => {
    it('should return new section when existing is empty', () => {
      const section = '<thread id="t1">\n- obs\n</thread>';
      expect(replaceOrAppendThreadSection('', 't1', section)).toBe(section);
    });

    it('should append when thread IDs differ', () => {
      const existing = '<thread id="t1">\n- old\n</thread>';
      const newSection = '<thread id="t2">\n- new\n</thread>';
      const result = replaceOrAppendThreadSection(existing, 't2', newSection);
      expect(result).toBe(`${existing}\n\n${newSection}`);
    });

    it('should append when section cannot be parsed (no thread tag)', () => {
      const existing = '<thread id="t1">\n- old\n</thread>';
      const newSection = 'plain text without thread tags';
      const result = replaceOrAppendThreadSection(existing, 't1', newSection);
      expect(result).toBe(`${existing}\n\n${newSection}`);
    });

    it('should merge when same thread ID and date match', () => {
      const existing = `<thread id="t1">
Date: March 5, 2026
- old observation
</thread>`;
      const newSection = `<thread id="t1">
Date: March 5, 2026
- new observation
</thread>`;
      const result = replaceOrAppendThreadSection(existing, 't1', newSection);
      expect(result).toContain('- old observation');
      expect(result).toContain('- new observation');
      // Should be a single thread section, not two
      const threadCount = (result.match(/<thread/g) || []).length;
      expect(threadCount).toBe(1);
    });

    it('should append when same thread ID but different date', () => {
      const existing = `<thread id="t1">
Date: March 1, 2026
- old observation
</thread>`;
      const newSection = `<thread id="t1">
Date: March 5, 2026
- new observation
</thread>`;
      const result = replaceOrAppendThreadSection(existing, 't1', newSection);
      // Different dates = append, not merge
      expect(result).toBe(`${existing}\n\n${newSection}`);
    });

    it('should merge with the correct date section when multiple sections share the same thread ID', () => {
      const existing = `<thread id="t1">
Date: March 1, 2026
- early obs
</thread>

<thread id="t1">
Date: March 5, 2026
- later obs
</thread>`;
      const newSection = `<thread id="t1">
Date: March 5, 2026
- newest obs
</thread>`;
      const result = replaceOrAppendThreadSection(existing, 't1', newSection);
      // Should merge into the March 5 section, not the March 1 section
      expect(result).toContain('early obs');
      expect(result).toContain('later obs');
      expect(result).toContain('newest obs');
      // The March 1 section should remain untouched
      const march1Section = result.match(/<thread id="t1">\nDate: March 1, 2026\n[\s\S]*?<\/thread>/);
      expect(march1Section).toBeTruthy();
      expect(march1Section![0]).not.toContain('newest obs');
    });

    it('should preserve other thread sections when merging', () => {
      const existing = `<thread id="t1">
Date: March 5, 2026
- t1 obs
</thread>

<thread id="t2">
Date: March 5, 2026
- t2 obs
</thread>`;
      const newSection = `<thread id="t1">
Date: March 5, 2026
- t1 new obs
</thread>`;
      const result = replaceOrAppendThreadSection(existing, 't1', newSection);
      expect(result).toContain('t2 obs');
      expect(result).toContain('t1 new obs');
    });
  });

  describe('sortThreadsByOldestMessage', () => {
    it('should sort by oldest message ascending', () => {
      const now = Date.now();
      const map = new Map<string, MastraDBMessage[]>([
        ['recent', [createMsg('1', new Date(now - 1000))]],
        ['oldest', [createMsg('2', new Date(now - 10000))]],
        ['middle', [createMsg('3', new Date(now - 5000))]],
      ]);
      expect(sortThreadsByOldestMessage(map)).toEqual(['oldest', 'middle', 'recent']);
    });

    it('should use earliest message when thread has multiple messages', () => {
      const now = Date.now();
      const map = new Map<string, MastraDBMessage[]>([
        ['a', [createMsg('1', new Date(now - 2000)), createMsg('2', new Date(now))]],
        ['b', [createMsg('3', new Date(now - 5000)), createMsg('4', new Date(now - 1000))]],
      ]);
      // Thread 'b' has oldest message at -5000
      expect(sortThreadsByOldestMessage(map)).toEqual(['b', 'a']);
    });

    it('should treat missing timestamps as now (most recent)', () => {
      const now = Date.now();
      const map = new Map<string, MastraDBMessage[]>([
        ['has-date', [createMsg('1', new Date(now - 10000))]],
        ['no-date', [createMsg('2')]],
      ]);
      expect(sortThreadsByOldestMessage(map)[0]).toBe('has-date');
    });

    it('should handle single thread', () => {
      const map = new Map<string, MastraDBMessage[]>([['only', [createMsg('1', new Date('2025-01-01'))]]]);
      expect(sortThreadsByOldestMessage(map)).toEqual(['only']);
    });

    it('should handle empty map', () => {
      expect(sortThreadsByOldestMessage(new Map())).toEqual([]);
    });
  });

  describe('combineObservationsForBuffering', () => {
    it('should return undefined when both are undefined', () => {
      expect(combineObservationsForBuffering(undefined, undefined)).toBeUndefined();
    });

    it('should return undefined when both are empty strings', () => {
      expect(combineObservationsForBuffering('', '')).toBeUndefined();
    });

    it('should return active when no buffered', () => {
      expect(combineObservationsForBuffering('- Active obs', undefined)).toBe('- Active obs');
    });

    it('should return buffered when no active', () => {
      expect(combineObservationsForBuffering(undefined, '- Buffered obs')).toBe('- Buffered obs');
    });

    it('should combine both with separator', () => {
      const result = combineObservationsForBuffering('- Active', '- Buffered');
      expect(result).toContain('- Active');
      expect(result).toContain('- Buffered');
      expect(result).toContain('BUFFERED (pending activation)');
    });

    it('should return active when buffered is empty string', () => {
      expect(combineObservationsForBuffering('- Active', '')).toBe('- Active');
    });

    it('should return buffered when active is empty string', () => {
      expect(combineObservationsForBuffering('', '- Buffered')).toBe('- Buffered');
    });
  });
});
