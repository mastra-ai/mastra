import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';

describe('Tool requestContextSchema', () => {
  const requestContextSchema = z.object({
    userId: z.string(),
    apiKey: z.string(),
  });

  describe('validation', () => {
    it('should pass validation when requestContext matches schema', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should return validation error when requestContext is missing required fields', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string }>();
      requestContext.set('userId', 'user-123');
      // Missing apiKey

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Request context validation failed');
      expect(result.message).toContain('apiKey');
    });

    it('should return validation error when requestContext has invalid field types', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 123 as any); // Wrong type
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Request context validation failed');
      expect(result.message).toContain('userId');
    });

    it('should include tool ID in error message', async () => {
      const tool = createTool({
        id: 'my-special-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: async () => ({ success: true }),
      });

      const requestContext = new RequestContext();
      // Empty context, missing required fields

      const result = await tool.execute!({}, { requestContext });

      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('my-special-tool');
    });
  });

  describe('backwards compatibility', () => {
    it('should work without requestContextSchema', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const requestContext = new RequestContext();
      requestContext.set('anything', 'value');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should work without requestContext in context', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const result = await tool.execute!({}, {});

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should work when execute is called with no context', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const result = await tool.execute!({}, undefined as any);

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('typed requestContext access', () => {
    it('should provide typed requestContext in execute function', async () => {
      const schema = z.object({
        tenantId: z.string(),
        permissions: z.array(z.string()),
      });

      let capturedContext: any;
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema: schema,
        execute: async (_, context) => {
          capturedContext = context;
          return { success: true };
        },
      });

      const requestContext = new RequestContext<{ tenantId: string; permissions: string[] }>();
      requestContext.set('tenantId', 'tenant-abc');
      requestContext.set('permissions', ['read', 'write']);

      await tool.execute!({}, { requestContext });

      // Verify the requestContext is passed through
      expect(capturedContext.requestContext).toBeDefined();
      expect(capturedContext.requestContext.get('tenantId')).toBe('tenant-abc');
      expect(capturedContext.requestContext.get('permissions')).toEqual(['read', 'write']);

      // Verify the .all getter works
      const all = capturedContext.requestContext.all;
      expect(all.tenantId).toBe('tenant-abc');
      expect(all.permissions).toEqual(['read', 'write']);
    });
  });

  describe('combined with inputSchema validation', () => {
    it('should validate both inputSchema and requestContextSchema', async () => {
      const inputSchema = z.object({
        query: z.string(),
      });

      const executeFn = vi.fn().mockResolvedValue({ result: 'found' });
      const tool = createTool({
        id: 'search-tool',
        description: 'A search tool',
        inputSchema,
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({ query: 'test search' }, { requestContext });

      expect(executeFn).toHaveBeenCalledWith(
        { query: 'test search' },
        expect.objectContaining({ requestContext }),
      );
      expect(result).toEqual({ result: 'found' });
    });

    it('should fail on inputSchema validation before requestContextSchema validation', async () => {
      const inputSchema = z.object({
        query: z.string(),
      });

      const executeFn = vi.fn().mockResolvedValue({ result: 'found' });
      const tool = createTool({
        id: 'search-tool',
        description: 'A search tool',
        inputSchema,
        requestContextSchema,
        execute: executeFn,
      });

      // Invalid input and missing requestContext values
      const requestContext = new RequestContext();

      const result = await tool.execute!({ query: 123 as any }, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      // Input validation should fail first
      expect(result.message).toContain('Tool input validation failed');
    });
  });
});
