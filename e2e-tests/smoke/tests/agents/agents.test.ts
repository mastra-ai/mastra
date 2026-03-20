import { describe, it, expect } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

// Agent generation/streaming (POST /generate, /stream) requires a valid LLM API key
// and is not tested here. These tests cover only the metadata/discovery endpoints.
describe('agents', () => {
  describe('discovery', () => {
    it('should list all registered agents', async () => {
      const { status, data } = await fetchJson<Record<string, any>>('/api/agents');

      expect(status).toBe(200);
      expect(data).toHaveProperty('test-agent');
      expect(data['test-agent'].name).toBe('Test Agent');
    });

    it('should get agent metadata by ID', async () => {
      const { status, data } = await fetchJson<any>('/api/agents/test-agent');

      expect(status).toBe(200);
      expect(data.name).toBe('Test Agent');
      expect(data.source).toBe('code');
      expect(data.instructions).toBe('You are a helpful test agent.');
      expect(data.description).toBe('');
    });

    it('should include agent tools in metadata', async () => {
      const { data } = await fetchJson<any>('/api/agents/test-agent');

      expect(Object.keys(data.tools).sort()).toEqual(['calculator', 'string-transform']);

      // Verify tool details are serialized
      expect(data.tools.calculator.id).toBe('calculator');
      expect(data.tools.calculator.description).toBe('Performs basic arithmetic operations');
      expect(data.tools['string-transform'].id).toBe('string-transform');
      expect(data.tools['string-transform'].description).toBe('Transforms strings in various ways');
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await fetchApi('/api/agents/does-not-exist');
      expect(res.status).toBe(404);
    });
  });
});
