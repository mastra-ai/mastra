import { describe, it, expect, beforeEach } from 'vitest';
import { deriveReadScope, InMemoryFileReadTracker } from './file-read-tracker';

describe('InMemoryFileReadTracker', () => {
  let tracker: InMemoryFileReadTracker;

  beforeEach(() => {
    tracker = new InMemoryFileReadTracker();
  });

  describe('recordRead / getReadRecord', () => {
    it('should record a file read', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt);

      const record = tracker.getReadRecord('/test/file.txt');
      expect(record).toBeDefined();
      expect(record?.path).toBe('/test/file.txt');
      expect(record?.modifiedAtRead).toEqual(modifiedAt);
      expect(record?.readAt).toBeInstanceOf(Date);
    });

    it('should return undefined for unread files', () => {
      const record = tracker.getReadRecord('/nonexistent.txt');
      expect(record).toBeUndefined();
    });

    it('should update record on subsequent reads', () => {
      const modifiedAt1 = new Date('2024-01-15T10:00:00Z');
      const modifiedAt2 = new Date('2024-01-15T11:00:00Z');

      tracker.recordRead('/test/file.txt', modifiedAt1);
      const record1 = tracker.getReadRecord('/test/file.txt');

      tracker.recordRead('/test/file.txt', modifiedAt2);
      const record2 = tracker.getReadRecord('/test/file.txt');

      expect(record2?.modifiedAtRead).toEqual(modifiedAt2);
      expect(record2?.readAt.getTime()).toBeGreaterThanOrEqual(record1!.readAt.getTime());
    });
  });

  describe('needsReRead', () => {
    it('should return needsReRead: true for unread files', () => {
      const currentModifiedAt = new Date();
      const result = tracker.needsReRead('/unread.txt', currentModifiedAt);

      expect(result.needsReRead).toBe(true);
      expect(result.reason).toContain('has not been read');
    });

    it('should return needsReRead: false when file not modified', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt);

      const result = tracker.needsReRead('/test/file.txt', modifiedAt);
      expect(result.needsReRead).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should return needsReRead: true when file was modified after read', () => {
      const readModifiedAt = new Date('2024-01-15T10:00:00Z');
      const currentModifiedAt = new Date('2024-01-15T11:00:00Z');

      tracker.recordRead('/test/file.txt', readModifiedAt);
      const result = tracker.needsReRead('/test/file.txt', currentModifiedAt);

      expect(result.needsReRead).toBe(true);
      expect(result.reason).toContain('was modified since last read');
    });

    it('should return needsReRead: false when current modifiedAt equals read modifiedAt', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt);

      const sameTime = new Date('2024-01-15T10:00:00Z');
      const result = tracker.needsReRead('/test/file.txt', sameTime);

      expect(result.needsReRead).toBe(false);
    });
  });

  describe('clearReadRecord', () => {
    it('should clear a read record', () => {
      const modifiedAt = new Date();
      tracker.recordRead('/test/file.txt', modifiedAt);
      expect(tracker.getReadRecord('/test/file.txt')).toBeDefined();

      tracker.clearReadRecord('/test/file.txt');
      expect(tracker.getReadRecord('/test/file.txt')).toBeUndefined();
    });

    it('should not throw when clearing non-existent record', () => {
      expect(() => tracker.clearReadRecord('/nonexistent.txt')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all records', () => {
      const modifiedAt = new Date();
      tracker.recordRead('/file1.txt', modifiedAt);
      tracker.recordRead('/file2.txt', modifiedAt);

      tracker.clear();

      expect(tracker.getReadRecord('/file1.txt')).toBeUndefined();
      expect(tracker.getReadRecord('/file2.txt')).toBeUndefined();
    });
  });

  describe('filesystem scope', () => {
    const scopeA = 'local:/base/a';
    const scopeB = 'local:/base/b';

    it('should store the recorded scope on the read record', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt, scopeA);

      expect(tracker.getReadRecord('/test/file.txt')?.scope).toBe(scopeA);
    });

    it('should pass when the scope matches the recorded scope', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt, scopeA);

      const result = tracker.needsReRead('/test/file.txt', modifiedAt, scopeA);
      expect(result.needsReRead).toBe(false);
    });

    it('should require re-read when the scope differs from the recorded scope', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt, scopeA);

      const result = tracker.needsReRead('/test/file.txt', modifiedAt, scopeB);
      expect(result.needsReRead).toBe(true);
      expect(result.reason).toContain('different filesystem');
    });

    it('should fail closed when a record without scope is checked against a scope', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt);

      const result = tracker.needsReRead('/test/file.txt', modifiedAt, scopeA);
      expect(result.needsReRead).toBe(true);
      expect(result.reason).toContain('different filesystem');
    });

    it('should match when neither record nor check carry a scope', () => {
      const modifiedAt = new Date('2024-01-15T10:00:00Z');
      tracker.recordRead('/test/file.txt', modifiedAt);

      const result = tracker.needsReRead('/test/file.txt', modifiedAt);
      expect(result.needsReRead).toBe(false);
    });
  });

  describe('path normalization', () => {
    it('should normalize duplicate slashes', () => {
      const modifiedAt = new Date();
      tracker.recordRead('//test//file.txt', modifiedAt);

      expect(tracker.getReadRecord('/test/file.txt')).toBeDefined();
      expect(tracker.getReadRecord('//test//file.txt')).toBeDefined();
    });

    it('should normalize trailing slashes', () => {
      const modifiedAt = new Date();
      tracker.recordRead('/test/dir/', modifiedAt);

      expect(tracker.getReadRecord('/test/dir')).toBeDefined();
      expect(tracker.getReadRecord('/test/dir/')).toBeDefined();
    });

    it('should handle root path', () => {
      const modifiedAt = new Date();
      tracker.recordRead('/', modifiedAt);

      expect(tracker.getReadRecord('/')).toBeDefined();
    });
  });
});

describe('deriveReadScope', () => {
  it('should combine provider and basePath when basePath is set', () => {
    expect(deriveReadScope({ provider: 'local', basePath: '/projects/app' })).toBe('local:/projects/app');
  });

  it('should fall back to the bare provider when basePath is missing', () => {
    expect(deriveReadScope({ provider: 'composite' })).toBe('composite');
    expect(deriveReadScope({ provider: 'memory', basePath: undefined })).toBe('memory');
  });

  it('should derive different scopes for different base paths on the same provider', () => {
    const a = deriveReadScope({ provider: 'local', basePath: '/base/a' });
    const b = deriveReadScope({ provider: 'local', basePath: '/base/b' });
    expect(a).not.toBe(b);
  });

  it('should derive identical scopes for identical configurations', () => {
    const a = deriveReadScope({ provider: 'local', basePath: '/same/path' });
    const b = deriveReadScope({ provider: 'local', basePath: '/same/path' });
    expect(a).toBe(b);
  });
});
