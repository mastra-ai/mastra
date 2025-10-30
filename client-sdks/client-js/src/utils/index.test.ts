import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { parseClientRequestContext, base64RequestContext } from './index';

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
