import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('agent-scoped tools', () => {
  describe('get tool via agent', () => {
    it('should get calculator tool metadata through agent endpoint', async () => {
      const { status, data } = await fetchJson<any>('/api/agents/test-agent/tools/calculator');

      expect(status).toBe(200);
      expect(data.id).toBe('calculator');
      expect(data.description).toBe('Performs basic arithmetic operations');
    });

    it('should get string-transform tool metadata through agent endpoint', async () => {
      const { status, data } = await fetchJson<any>('/api/agents/test-agent/tools/string-transform');

      expect(status).toBe(200);
      expect(data.id).toBe('string-transform');
      expect(data.description).toBe('Transforms strings in various ways');
    });

    it('should return 404 for tool not assigned to agent', async () => {
      // always-fails is registered globally but not assigned to test-agent
      const res = await fetchApi('/api/agents/test-agent/tools/always-fails');
      expect(res.status).toBe(404);
    });
  });

  describe('execute tool via agent', () => {
    it('should execute calculator through agent endpoint', async () => {
      const { status, data } = await fetchJson<any>('/api/agents/test-agent/tools/calculator/execute', {
        method: 'POST',
        body: JSON.stringify({
          data: { operation: 'add', a: 10, b: 32 },
        }),
      });

      expect(status).toBe(200);
      expect(data).toEqual({ result: 42 });
    });

    it('should execute string-transform through agent endpoint', async () => {
      const { status, data } = await fetchJson<any>(
        '/api/agents/test-agent/tools/string-transform/execute',
        {
          method: 'POST',
          body: JSON.stringify({
            data: { text: 'mastra', transform: 'reverse' },
          }),
        },
      );

      expect(status).toBe(200);
      expect(data).toEqual({ result: 'artsam' });
    });

    it('should return 404 when executing tool not assigned to agent', async () => {
      const res = await fetchApi('/api/agents/test-agent/tools/always-fails/execute', {
        method: 'POST',
        body: JSON.stringify({ data: { message: 'boom' } }),
      });

      expect(res.status).toBe(404);
    });
  });
});
