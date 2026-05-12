import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('tools', () => {
  describe('discovery', () => {
    it('should list all registered tools', async () => {
      const { status, data } = await fetchJson<Record<string, any>>('/api/tools');

      expect(status).toBe(200);

      // Tools are keyed by registration name (which may differ from tool.id)
      // Verify by checking that tool IDs exist in the serialized values
      const toolIds = Object.values(data).map((t: any) => t.id);
      expect(toolIds).toContain('calculator');
      expect(toolIds).toContain('string-transform');
      expect(toolIds).toContain('always-fails');
      expect(toolIds).toContain('timestamp');
    });

    it('should get tool by ID with schema', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator');

      expect(status).toBe(200);
      expect(data.id).toBe('calculator');
      expect(data.description).toBe('Performs basic arithmetic operations');
      expect(data.requireApproval).toBe(false);

      // inputSchema and outputSchema are superjson-serialized JSON Schemas
      const inputSchema = JSON.parse(data.inputSchema).json;
      expect(inputSchema.type).toBe('object');
      expect(inputSchema.required).toEqual(['operation', 'a', 'b']);
      expect(inputSchema.properties.operation.enum).toEqual(['add', 'subtract', 'multiply', 'divide']);
      expect(inputSchema.properties.a.type).toBe('number');
      expect(inputSchema.properties.b.type).toBe('number');

      const outputSchema = JSON.parse(data.outputSchema).json;
      expect(outputSchema.type).toBe('object');
      expect(outputSchema.properties.result.type).toBe('number');
    });

    it('should return 404 for non-existent tool', async () => {
      const res = await fetchApi('/api/tools/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('execution', () => {
    it('should execute calculator tool — addition', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'add', a: 10, b: 32 },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 42 });
    });

    it('should execute calculator tool — multiplication', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'multiply', a: 7, b: 6 },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 42 });
    });

    it('should execute calculator tool — subtraction', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'subtract', a: 100, b: 58 },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 42 });
    });

    it('should execute calculator tool — division', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'divide', a: 84, b: 2 },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 42 });
    });

    it('should execute string-transform tool', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/string-transform/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { text: 'Hello World', transform: 'upper' },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 'HELLO WORLD' });
    });

    it('should execute string-transform reverse', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/string-transform/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { text: 'mastra', transform: 'reverse' },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 'artsam' });
    });

    it('should execute string-transform length', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/string-transform/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { text: 'mastra', transform: 'length' },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: '6' });
    });

    it('should execute timestamp tool with no input', async () => {
      const before = Date.now();
      const { status, data } = await fetchJson<any>('/api/tools/timestamp/execute', {
        method: 'POST',
        body: JSON.stringify({ data: {} }),
      });
      const after = Date.now();

      expect(status).toBe(200);
      expect(data.timestamp).toBeGreaterThanOrEqual(before);
      expect(data.timestamp).toBeLessThanOrEqual(after);
      // ISO string should parse to same timestamp
      expect(new Date(data.iso).getTime()).toBe(data.timestamp);
    });

    it('should return 500 when executing tool that throws', async () => {
      const res = await fetchApi('/api/tools/always-fails/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { message: 'boom' },
        }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Tool error: boom');
    });

    it('should return 500 when dividing by zero', async () => {
      const res = await fetchApi('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'divide', a: 42, b: 0 },
        }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Division by zero');
    });

    it('should return validation error for missing required fields', async () => {
      const { status, data } = await fetchJson<any>('/api/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'add' },
        }),
      });

      // Tool input validation returns 200 with error: true and structured validation errors
      // Error messages differ between zod 3 ("Required") and zod 4 ("Invalid input: expected number, received undefined")
      expect(status).toBe(200);
      expect(data.error).toBe(true);
      expect(data.message).toContain('Tool input validation failed for calculator');
      expect(data.message).toMatch(/a: (?:Required|Invalid input: expected number, received undefined)/);
      expect(data.message).toMatch(/b: (?:Required|Invalid input: expected number, received undefined)/);
      expect(data.validationErrors.fields.a.errors).toHaveLength(1);
      expect(data.validationErrors.fields.b.errors).toHaveLength(1);
    });

    it('should return 404 when executing non-existent tool', async () => {
      const res = await fetchApi('/api/tools/does-not-exist/execute', {
        method: 'POST',
        body: JSON.stringify({ data: {} }),
      });

      expect(res.status).toBe(404);
    });
  });
});
