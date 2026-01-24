import { describe, it, expect, beforeEach } from 'vitest';

import type { FileStorageProvider, FileInfo, ObservabilityEvent } from '../types.js';

import { processFile, listPendingFiles } from './file-processor.js';

// Mock file storage
function createMockFileStorage(): FileStorageProvider & {
  files: Map<string, Buffer>;
  setFile: (path: string, content: string) => void;
} {
  const files = new Map<string, Buffer>();

  return {
    type: 'mock' as const,
    files,
    setFile: (path: string, content: string) => {
      files.set(path, Buffer.from(content, 'utf-8'));
    },

    async write(path: string, content: Buffer | string): Promise<void> {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
      files.set(path, buffer);
    },

    async read(path: string): Promise<Buffer> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },

    async list(prefix: string): Promise<FileInfo[]> {
      const result: FileInfo[] = [];
      for (const [path, content] of files) {
        if (path.startsWith(prefix) && !path.includes('/processed/')) {
          result.push({
            path,
            size: content.length,
            lastModified: new Date(),
          });
        }
      }
      return result;
    },

    async delete(path: string): Promise<void> {
      files.delete(path);
    },

    async move(from: string, to: string): Promise<void> {
      const content = files.get(from);
      if (content) {
        files.set(to, content);
        files.delete(from);
      }
    },

    async exists(path: string): Promise<boolean> {
      return files.has(path);
    },
  };
}

describe('processFile', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
  });

  describe('valid JSONL files', () => {
    it('should parse a single trace event', async () => {
      const traceEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 'trace_1',
          projectId: 'proj_1',
          name: 'test-trace',
          status: 'ok',
          startTime: '2025-01-23T12:00:00.000Z',
          endTime: '2025-01-23T12:00:01.000Z',
          durationMs: 1000,
          metadata: {},
        },
      };
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, JSON.stringify(traceEvent) + '\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.type).toBe('trace');
      // Data is stored as parsed JSON, so Date objects become strings
      expect(result.events[0]?.data.type).toBe('trace');
      expect((result.events[0]?.data as ObservabilityEvent).data.traceId).toBe('trace_1');
      expect(result.events[0]?.line).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse multiple events from a single file', async () => {
      const events: ObservabilityEvent[] = [
        {
          type: 'trace',
          data: {
            traceId: 't1',
            projectId: 'p1',
            name: 'test1',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            metadata: {},
          },
        },
        {
          type: 'span',
          data: {
            spanId: 's1',
            traceId: 't1',
            projectId: 'p1',
            name: 'span1',
            kind: 'internal',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            attributes: {},
            events: [],
          },
        },
        {
          type: 'log',
          data: {
            id: 'l1',
            projectId: 'p1',
            level: 'info',
            message: 'test log',
            timestamp: new Date(),
            attributes: {},
          },
        },
      ];
      const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(3);
      expect(result.events[0]?.type).toBe('trace');
      expect(result.events[1]?.type).toBe('span');
      expect(result.events[2]?.type).toBe('log');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse all event types correctly', async () => {
      const events: ObservabilityEvent[] = [
        {
          type: 'trace',
          data: {
            traceId: 't1',
            projectId: 'p1',
            name: 'trace',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            metadata: {},
          },
        },
        {
          type: 'span',
          data: {
            spanId: 's1',
            traceId: 't1',
            projectId: 'p1',
            name: 'span',
            kind: 'server',
            status: 'ok',
            startTime: new Date(),
            endTime: null,
            durationMs: null,
            attributes: {},
            events: [],
          },
        },
        {
          type: 'log',
          data: {
            id: 'l1',
            projectId: 'p1',
            level: 'error',
            message: 'error log',
            timestamp: new Date(),
            attributes: {},
          },
        },
        {
          type: 'metric',
          data: {
            id: 'm1',
            projectId: 'p1',
            name: 'cpu_usage',
            type: 'gauge',
            value: 0.75,
            timestamp: new Date(),
            labels: {},
          },
        },
        {
          type: 'score',
          data: {
            id: 'sc1',
            projectId: 'p1',
            name: 'quality_score',
            value: 0.95,
            timestamp: new Date(),
            metadata: {},
          },
        },
      ];
      const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(5);
      expect(result.events.map(e => e.type)).toEqual(['trace', 'span', 'log', 'metric', 'score']);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip empty lines', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      const content = '\n' + JSON.stringify(event) + '\n\n\n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip whitespace-only lines', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      const content = '   \n' + JSON.stringify(event) + '\n  \t  \n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('metadata extraction', () => {
    it('should extract metadata from file path', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      const filePath = 'observability/trace/proj_123/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, JSON.stringify(event) + '\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.metadata).not.toBeNull();
      expect(result.metadata?.type).toBe('trace');
      expect(result.metadata?.projectId).toBe('proj_123');
      expect(result.metadata?.timestamp).toBe('20250123T120000Z');
    });

    it('should return null metadata for invalid file paths', async () => {
      const event: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      const filePath = 'invalid/path/file.jsonl';
      fileStorage.setFile(filePath, JSON.stringify(event) + '\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.metadata).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should record error for invalid JSON', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, 'not valid json\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.line).toBe(1);
      expect(result.errors[0]?.error).toContain('Unexpected token');
    });

    it('should record error for missing event type', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, '{"data": {"traceId": "t1"}}\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('Invalid or missing event type');
    });

    it('should record error for invalid event type', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, '{"type": "invalid_type", "data": {}}\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('Invalid or missing event type');
    });

    it('should record error for missing data field', async () => {
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, '{"type": "trace"}\n');

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.error).toContain('Missing event data field');
    });

    it('should continue processing after encountering errors', async () => {
      const validEvent: ObservabilityEvent = {
        type: 'trace',
        data: {
          traceId: 't1',
          projectId: 'p1',
          name: 'test',
          status: 'ok',
          startTime: new Date(),
          endTime: null,
          durationMs: null,
          metadata: {},
        },
      };
      const content = 'invalid json\n' + JSON.stringify(validEvent) + '\n{"type": "bad"}\n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.line).toBe(1);
      expect(result.errors[1]?.line).toBe(3);
    });

    it('should track correct line numbers for errors', async () => {
      const content = '\n\n{"type": "invalid"}\n\n{"also": "invalid"}\n';
      const filePath = 'observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl';
      fileStorage.setFile(filePath, content);

      const result = await processFile(fileStorage, filePath);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.line).toBe(3);
      expect(result.errors[1]?.line).toBe(5);
    });
  });
});

describe('listPendingFiles', () => {
  let fileStorage: ReturnType<typeof createMockFileStorage>;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
  });

  it('should return empty array when no files exist', async () => {
    const files = await listPendingFiles(fileStorage, 'observability');

    expect(files).toHaveLength(0);
  });

  it('should list pending JSONL files', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');
    fileStorage.setFile('observability/trace/proj_1/20250123T120100Z_xyz789ghi012.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability');

    expect(files).toHaveLength(2);
    expect(files.every(f => f.endsWith('.jsonl'))).toBe(true);
  });

  it('should exclude processed files', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');
    fileStorage.setFile('observability/trace/proj_1/processed/20250123T120100Z_xyz789.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability');

    expect(files).toHaveLength(1);
    expect(files[0]).toContain('20250123T120000Z');
    expect(files[0]).not.toContain('processed');
  });

  it('should respect limit option', async () => {
    for (let i = 0; i < 10; i++) {
      fileStorage.setFile(`observability/trace/proj_1/20250123T12000${i}Z_abc${i}xyz.jsonl`, '{}');
    }

    const files = await listPendingFiles(fileStorage, 'observability', { limit: 5 });

    expect(files).toHaveLength(5);
  });

  it('should filter by event type', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');
    fileStorage.setFile('observability/span/proj_1/20250123T120100Z_xyz789ghi012.jsonl', '{}');
    fileStorage.setFile('observability/log/proj_1/20250123T120200Z_mno345pqr678.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability', { eventType: 'trace' });

    expect(files).toHaveLength(1);
    expect(files[0]).toContain('/trace/');
  });

  it('should filter by project ID', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');
    fileStorage.setFile('observability/trace/proj_2/20250123T120100Z_xyz789ghi012.jsonl', '{}');
    fileStorage.setFile('observability/span/proj_1/20250123T120200Z_mno345pqr678.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability', { projectId: 'proj_1' });

    expect(files).toHaveLength(2);
    expect(files.every(f => f.includes('/proj_1/'))).toBe(true);
  });

  it('should filter by both event type and project ID', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');
    fileStorage.setFile('observability/trace/proj_2/20250123T120100Z_xyz789ghi012.jsonl', '{}');
    fileStorage.setFile('observability/span/proj_1/20250123T120200Z_mno345pqr678.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability', {
      eventType: 'trace',
      projectId: 'proj_1',
    });

    expect(files).toHaveLength(1);
    expect(files[0]).toContain('/trace/');
    expect(files[0]).toContain('/proj_1/');
  });

  it('should handle basePath with trailing slash', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability/');

    expect(files).toHaveLength(1);
  });

  it('should handle basePath without trailing slash', async () => {
    fileStorage.setFile('observability/trace/proj_1/20250123T120000Z_abc123def456.jsonl', '{}');

    const files = await listPendingFiles(fileStorage, 'observability');

    expect(files).toHaveLength(1);
  });
});
