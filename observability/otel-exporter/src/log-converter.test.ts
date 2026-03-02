import type { ExportedLog } from '@mastra/core/observability';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { describe, it, expect } from 'vitest';

import { convertLog, mapSeverity, buildLogAttributes } from './log-converter';

describe('log-converter', () => {
  describe('mapSeverity', () => {
    it('should map debug to SeverityNumber.DEBUG', () => {
      expect(mapSeverity('debug')).toBe(SeverityNumber.DEBUG);
    });

    it('should map info to SeverityNumber.INFO', () => {
      expect(mapSeverity('info')).toBe(SeverityNumber.INFO);
    });

    it('should map warn to SeverityNumber.WARN', () => {
      expect(mapSeverity('warn')).toBe(SeverityNumber.WARN);
    });

    it('should map error to SeverityNumber.ERROR', () => {
      expect(mapSeverity('error')).toBe(SeverityNumber.ERROR);
    });

    it('should map fatal to SeverityNumber.FATAL', () => {
      expect(mapSeverity('fatal')).toBe(SeverityNumber.FATAL);
    });
  });

  describe('buildLogAttributes', () => {
    it('should include data fields with mastra.log prefix', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        data: { requestId: '123', statusCode: 200 },
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.log.requestId']).toBe('123');
      expect(attrs['mastra.log.statusCode']).toBe(200);
    });

    it('should JSON-stringify object values in data', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        data: { headers: { 'content-type': 'application/json' } },
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.log.headers']).toBe('{"content-type":"application/json"}');
    });

    it('should include metadata fields with mastra.metadata prefix', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        metadata: { environment: 'production', userId: 'user-1' },
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.metadata.environment']).toBe('production');
      expect(attrs['mastra.metadata.userId']).toBe('user-1');
    });

    it('should include tags as JSON-stringified array', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        tags: ['auth', 'error'],
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.tags']).toBe(JSON.stringify(['auth', 'error']));
    });

    it('should skip null/undefined values in data and metadata', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        data: { present: 'yes', absent: undefined, empty: null } as any,
        metadata: { valid: 'value', missing: undefined } as any,
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.log.present']).toBe('yes');
      expect(attrs['mastra.log.absent']).toBeUndefined();
      expect(attrs['mastra.log.empty']).toBeUndefined();
      expect(attrs['mastra.metadata.valid']).toBe('value');
      expect(attrs['mastra.metadata.missing']).toBeUndefined();
    });

    it('should return empty attributes when log has no data/metadata/tags', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
      };

      const attrs = buildLogAttributes(log);
      expect(Object.keys(attrs).length).toBe(0);
    });

    it('should not include mastra.tags when tags is empty', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'info',
        message: 'test',
        tags: [],
      };

      const attrs = buildLogAttributes(log);
      expect(attrs['mastra.tags']).toBeUndefined();
    });
  });

  describe('convertLog', () => {
    it('should convert a full ExportedLog to OtelLogEmitParams', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-06-15T12:30:00Z'),
        level: 'error',
        message: 'Database connection failed',
        data: { host: 'db.example.com', port: 5432 },
        traceId: 'abc123',
        spanId: 'def456',
        tags: ['database', 'critical'],
        metadata: { environment: 'production' },
      };

      const params = convertLog(log);

      expect(params.severityNumber).toBe(SeverityNumber.ERROR);
      expect(params.severityText).toBe('ERROR');
      expect(params.body).toBe('Database connection failed');
      expect(params.traceId).toBe('abc123');
      expect(params.spanId).toBe('def456');

      // Timestamp should be HrTime [seconds, nanoseconds]
      expect(params.timestamp).toHaveLength(2);
      expect(params.timestamp[0]).toBeGreaterThan(0);
      expect(params.timestamp[1]).toBeGreaterThanOrEqual(0);

      // Attributes should include data, metadata, and tags
      expect(params.attributes['mastra.log.host']).toBe('db.example.com');
      expect(params.attributes['mastra.log.port']).toBe(5432);
      expect(params.attributes['mastra.metadata.environment']).toBe('production');
      expect(params.attributes['mastra.tags']).toBe(JSON.stringify(['database', 'critical']));
    });

    it('should handle a minimal ExportedLog', () => {
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        level: 'debug',
        message: 'simple message',
      };

      const params = convertLog(log);

      expect(params.severityNumber).toBe(SeverityNumber.DEBUG);
      expect(params.severityText).toBe('DEBUG');
      expect(params.body).toBe('simple message');
      expect(params.traceId).toBeUndefined();
      expect(params.spanId).toBeUndefined();
      expect(Object.keys(params.attributes).length).toBe(0);
    });

    it('should correctly convert timestamp to HrTime', () => {
      // 1704067200000 ms = 2024-01-01T00:00:00Z
      const log: ExportedLog = {
        timestamp: new Date('2024-01-01T00:00:00.123Z'),
        level: 'info',
        message: 'test',
      };

      const params = convertLog(log);
      const [seconds, nanoseconds] = params.timestamp;

      expect(seconds).toBe(Math.floor(new Date('2024-01-01T00:00:00.123Z').getTime() / 1000));
      expect(nanoseconds).toBe(123 * 1_000_000);
    });
  });
});
