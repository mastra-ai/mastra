import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { parseClientRequestContext, base64RequestContext, toQueryParams } from './index';

describe('Request Context Utils', () => {
  describe('parseClientRequestContext', () => {
    it('should parse RequestContext instance to plain object', () => {
      const requestContext = new RequestContext();
      requestContext.set('userId', '123');
      requestContext.set('sessionId', 'abc');

      const result = parseClientRequestContext(requestContext);

      expect(result).toEqual({
        userId: '123',
        sessionId: 'abc',
      });
    });

    it('should return plain object unchanged', () => {
      const requestContext = { userId: '123', sessionId: 'abc' };

      const result = parseClientRequestContext(requestContext);

      expect(result).toEqual(requestContext);
    });

    it('should return undefined for undefined input', () => {
      const result = parseClientRequestContext(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      const result = parseClientRequestContext(null as any);

      expect(result).toBeUndefined();
    });
  });

  describe('base64RequestContext', () => {
    it('should encode object to base64', () => {
      const requestContext = { userId: '123', sessionId: 'abc' };
      const expected = btoa(JSON.stringify(requestContext));

      const result = base64RequestContext(requestContext);

      expect(result).toBe(expected);
    });

    it('should handle complex objects', () => {
      const requestContext = {
        user: { id: '123', name: 'John' },
        session: { id: 'abc', expires: '2024-12-31' },
        metadata: { source: 'web', version: '1.0' },
      };
      const expected = btoa(JSON.stringify(requestContext));

      const result = base64RequestContext(requestContext);

      expect(result).toBe(expected);
    });

    it('should return undefined for undefined input', () => {
      const result = base64RequestContext(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      const result = base64RequestContext(null as any);

      expect(result).toBeUndefined();
    });

    it('should handle empty object', () => {
      const requestContext = {};
      const expected = btoa(JSON.stringify(requestContext));

      const result = base64RequestContext(requestContext);

      expect(result).toBe(expected);
    });
  });

  describe('Integration tests', () => {
    it('should work together with RequestContext instance', () => {
      const requestContext = new RequestContext();
      requestContext.set('tenantId', 'tenant-456');
      requestContext.set('orgId', 'org-789');

      const parsed = parseClientRequestContext(requestContext);
      const encoded = base64RequestContext(parsed);

      expect(parsed).toEqual({
        tenantId: 'tenant-456',
        orgId: 'org-789',
      });
      expect(encoded).toBe(
        btoa(
          JSON.stringify({
            tenantId: 'tenant-456',
            orgId: 'org-789',
          }),
        ),
      );
    });

    it('should work together with plain object', () => {
      const requestContext = { userId: '123', role: 'admin' };

      const parsed = parseClientRequestContext(requestContext);
      const encoded = base64RequestContext(parsed);

      expect(parsed).toEqual(requestContext);
      expect(encoded).toBe(btoa(JSON.stringify(requestContext)));
    });
  });
});

describe('toQueryParams', () => {
  describe('primitive values', () => {
    it('should convert string values', () => {
      const result = toQueryParams({ name: 'test' });
      expect(result).toBe('name=test');
    });

    it('should convert number values', () => {
      const result = toQueryParams({ page: 0, perPage: 10 });
      expect(result).toBe('page=0&perPage=10');
    });

    it('should convert boolean values', () => {
      const result = toQueryParams({ hasError: true });
      expect(result).toBe('hasError=true');
    });

    it('should skip undefined values', () => {
      const result = toQueryParams({ name: 'test', missing: undefined });
      expect(result).toBe('name=test');
    });

    it('should skip null values', () => {
      const result = toQueryParams({ name: 'test', missing: null });
      expect(result).toBe('name=test');
    });
  });

  describe('complex values', () => {
    it('should JSON-stringify object values', () => {
      const result = toQueryParams({ startedAt: { start: '2024-01-01' } });
      expect(result).toBe(`startedAt=${encodeURIComponent('{"start":"2024-01-01"}')}`);
    });

    it('should JSON-stringify array values', () => {
      const result = toQueryParams({ tags: ['a', 'b', 'c'] });
      expect(result).toBe(`tags=${encodeURIComponent('["a","b","c"]')}`);
    });

    it('should convert Date to ISO string at top level', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = toQueryParams({ createdAt: date });
      expect(result).toBe('createdAt=2024-01-15T10%3A30%3A00.000Z');
    });

    it('should convert Date to ISO string inside nested objects', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = toQueryParams({ startedAt: { start: date } });
      const expected = `startedAt=${encodeURIComponent('{"start":"2024-01-15T10:30:00.000Z"}')}`;
      expect(result).toBe(expected);
    });
  });

  describe('flattening nested objects', () => {
    it('should flatten pagination when specified', () => {
      const result = toQueryParams({ pagination: { page: 1, perPage: 20 } }, ['pagination']);
      expect(result).toBe('page=1&perPage=20');
    });

    it('should flatten filters when specified', () => {
      const result = toQueryParams({ filters: { spanType: 'agent_run', entityId: 'test-agent' } }, ['filters']);
      expect(result).toBe('spanType=agent_run&entityId=test-agent');
    });

    it('should flatten orderBy when specified', () => {
      const result = toQueryParams({ orderBy: { field: 'startedAt', direction: 'DESC' } }, ['orderBy']);
      expect(result).toBe('field=startedAt&direction=DESC');
    });

    it('should flatten multiple keys together', () => {
      const result = toQueryParams(
        {
          pagination: { page: 0, perPage: 10 },
          filters: { spanType: 'agent_run' },
          orderBy: { field: 'startedAt', direction: 'DESC' },
        },
        ['filters', 'pagination', 'orderBy'],
      );
      expect(result).toBe('page=0&perPage=10&spanType=agent_run&field=startedAt&direction=DESC');
    });

    it('should not flatten objects when no flattenKeys specified', () => {
      const result = toQueryParams({ metadata: { key: 'value' } });
      expect(result).toBe(`metadata=${encodeURIComponent('{"key":"value"}')}`);
    });

    it('should not flatten objects not in flattenKeys', () => {
      const result = toQueryParams({ metadata: { key: 'value' }, filters: { a: 1 } }, ['filters']);
      expect(result).toContain(`metadata=${encodeURIComponent('{"key":"value"}')}`);
      expect(result).toContain('a=1');
    });
  });

  describe('complex nested structures', () => {
    it('should handle filters with date range', () => {
      const result = toQueryParams(
        {
          pagination: { page: 0, perPage: 10 },
          filters: {
            startedAt: { start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z' },
            spanType: 'agent_run',
          },
        },
        ['filters', 'pagination'],
      );

      expect(result).toContain('page=0');
      expect(result).toContain('perPage=10');
      expect(result).toContain('spanType=agent_run');
      expect(result).toContain(
        `startedAt=${encodeURIComponent('{"start":"2024-01-01T00:00:00Z","end":"2024-01-31T23:59:59Z"}')}`,
      );
    });

    it('should handle empty object', () => {
      const result = toQueryParams({});
      expect(result).toBe('');
    });

    it('should handle object with only undefined values', () => {
      const result = toQueryParams({ a: undefined, b: undefined });
      expect(result).toBe('');
    });
  });
});
