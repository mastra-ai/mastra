import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFileReadTracker } from './file-read-tracker';

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
