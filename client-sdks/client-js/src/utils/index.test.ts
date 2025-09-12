import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, expect, it } from 'vitest';
import { parseClientRuntimeContext, base64RuntimeContext } from './index';

describe('Runtime Context Utils', () => {
  describe('parseClientRuntimeContext', () => {
    it('should parse RuntimeContext instance to plain object', () => {
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('userId', '123');
      runtimeContext.set('sessionId', 'abc');

      const result = parseClientRuntimeContext(runtimeContext);

      expect(result).toEqual({
        userId: '123',
        sessionId: 'abc',
      });
    });

    it('should return plain object unchanged', () => {
      const runtimeContext = { userId: '123', sessionId: 'abc' };

      const result = parseClientRuntimeContext(runtimeContext);

      expect(result).toEqual(runtimeContext);
    });

    it('should return undefined for undefined input', () => {
      const result = parseClientRuntimeContext(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      const result = parseClientRuntimeContext(null as any);

      expect(result).toBeUndefined();
    });
  });

  describe('base64RuntimeContext', () => {
    it('should encode object to base64', () => {
      const runtimeContext = { userId: '123', sessionId: 'abc' };
      const expected = btoa(JSON.stringify(runtimeContext));

      const result = base64RuntimeContext(runtimeContext);

      expect(result).toBe(expected);
    });

    it('should handle complex objects', () => {
      const runtimeContext = {
        user: { id: '123', name: 'John' },
        session: { id: 'abc', expires: '2024-12-31' },
        metadata: { source: 'web', version: '1.0' },
      };
      const expected = btoa(JSON.stringify(runtimeContext));

      const result = base64RuntimeContext(runtimeContext);

      expect(result).toBe(expected);
    });

    it('should return undefined for undefined input', () => {
      const result = base64RuntimeContext(undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      const result = base64RuntimeContext(null as any);

      expect(result).toBeUndefined();
    });

    it('should handle empty object', () => {
      const runtimeContext = {};
      const expected = btoa(JSON.stringify(runtimeContext));

      const result = base64RuntimeContext(runtimeContext);

      expect(result).toBe(expected);
    });
  });

  describe('Integration tests', () => {
    it('should work together with RuntimeContext instance', () => {
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('tenantId', 'tenant-456');
      runtimeContext.set('orgId', 'org-789');

      const parsed = parseClientRuntimeContext(runtimeContext);
      const encoded = base64RuntimeContext(parsed);

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
      const runtimeContext = { userId: '123', role: 'admin' };

      const parsed = parseClientRuntimeContext(runtimeContext);
      const encoded = base64RuntimeContext(parsed);

      expect(parsed).toEqual(runtimeContext);
      expect(encoded).toBe(btoa(JSON.stringify(runtimeContext)));
    });
  });
});
