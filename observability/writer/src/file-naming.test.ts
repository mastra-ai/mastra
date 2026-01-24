import { describe, it, expect } from 'vitest';
import {
  generateFilePath,
  generateDirectoryPath,
  parseFilePath,
  isPendingFile,
  getProcessedFilePath,
} from './file-naming.js';

describe('file-naming', () => {
  describe('generateFilePath', () => {
    it('should generate a valid file path', () => {
      const path = generateFilePath({
        basePath: 'observability',
        type: 'trace',
        projectId: 'proj_123',
      });

      expect(path).toMatch(/^observability\/trace\/proj_123\/\d{8}T\d{6}Z_[a-f0-9]+\.jsonl$/);
    });

    it('should use provided timestamp', () => {
      const timestamp = new Date('2025-01-23T12:00:00.000Z');
      const path = generateFilePath({
        basePath: 'observability',
        type: 'span',
        projectId: 'proj_456',
        timestamp,
      });

      expect(path).toContain('20250123T120000Z');
    });

    it('should handle different event types', () => {
      const types = ['trace', 'span', 'log', 'metric', 'score'] as const;

      for (const type of types) {
        const path = generateFilePath({
          basePath: 'obs',
          type,
          projectId: 'proj_1',
        });
        expect(path).toContain(`/${type}/`);
      }
    });

    it('should normalize trailing slashes in basePath', () => {
      const path = generateFilePath({
        basePath: 'observability/',
        type: 'log',
        projectId: 'proj_789',
      });

      expect(path).not.toContain('//');
      expect(path).toMatch(/^observability\/log\//);
    });
  });

  describe('generateDirectoryPath', () => {
    it('should generate directory path without filename', () => {
      const path = generateDirectoryPath({
        basePath: 'observability',
        type: 'metric',
        projectId: 'proj_123',
      });

      expect(path).toBe('observability/metric/proj_123');
    });
  });

  describe('parseFilePath', () => {
    it('should parse a valid file path', () => {
      const path = 'observability/trace/proj_123/20250123T120000Z_abc123def456.jsonl';
      const result = parseFilePath(path);

      expect(result).toEqual({
        basePath: 'observability',
        type: 'trace',
        projectId: 'proj_123',
        timestamp: '20250123T120000Z',
        uuid: 'abc123def456',
      });
    });

    it('should return null for invalid paths', () => {
      expect(parseFilePath('invalid/path.txt')).toBeNull();
      expect(parseFilePath('')).toBeNull();
      expect(parseFilePath('observability/trace/proj/file.json')).toBeNull();
    });

    it('should handle nested basePath', () => {
      const path = '/var/data/observability/span/proj_1/20250123T120000Z_abc789def012.jsonl';
      const result = parseFilePath(path);

      expect(result).toEqual({
        basePath: '/var/data/observability',
        type: 'span',
        projectId: 'proj_1',
        timestamp: '20250123T120000Z',
        uuid: 'abc789def012',
      });
    });
  });

  describe('isPendingFile', () => {
    it('should return true for pending JSONL files', () => {
      expect(isPendingFile('observability/trace/proj/file.jsonl')).toBe(true);
    });

    it('should return false for processed files', () => {
      expect(isPendingFile('observability/trace/proj/processed/file.jsonl')).toBe(false);
    });

    it('should return false for non-JSONL files', () => {
      expect(isPendingFile('observability/trace/proj/file.json')).toBe(false);
    });
  });

  describe('getProcessedFilePath', () => {
    it('should insert processed directory before filename', () => {
      const original = 'observability/trace/proj_123/20250123T120000Z_abc.jsonl';
      const processed = getProcessedFilePath(original);

      expect(processed).toBe('observability/trace/proj_123/processed/20250123T120000Z_abc.jsonl');
    });

    it('should handle file without directory', () => {
      const processed = getProcessedFilePath('file.jsonl');
      expect(processed).toBe('processed/file.jsonl');
    });
  });
});
