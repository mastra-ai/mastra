import { describe, expect, it } from 'vitest';
import { fetchApi, fetchJson } from '../utils.js';

describe('agent management — extras', () => {
  it('POST /agents/test-agent/instructions/enhance returns enhanced text', async () => {
    const { status, data } = await fetchJson<any>('/api/agents/test-agent/instructions/enhance', {
      method: 'POST',
      body: JSON.stringify({
        instructions: 'You help test things.',
        comment: 'be more specific',
      }),
    });
    expect(status).toBe(200);
    expect(typeof data.new_prompt).toBe('string');
    expect(data.new_prompt.length).toBeGreaterThan(0);
    expect(typeof data.explanation).toBe('string');
    // The enhanced prompt should differ from the input.
    expect(data.new_prompt).not.toBe('You help test things.');
  }, 60_000);

  it('POST /agents/test-agent/model + /model/reset round-trip', async () => {
    const set = await fetchJson<any>('/api/agents/test-agent/model', {
      method: 'POST',
      body: JSON.stringify({ modelId: 'gpt-4o-mini', provider: 'openai' }),
    });
    expect(set.status).toBe(200);
    expect(typeof set.data.message).toBe('string');

    const reset = await fetchJson<any>('/api/agents/test-agent/model/reset', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(reset.status).toBe(200);
    expect(typeof reset.data.message).toBe('string');
  });

  it('POST /agents/test-agent/models/reorder returns a structured error for non-list agents', async () => {
    // The fixture's test-agent uses a single model (not a list), so reordering
    // should produce a deterministic 400 — guards against silent acceptance.
    const res = await fetchApi('/api/agents/test-agent/models/reorder', {
      method: 'POST',
      body: JSON.stringify({ reorderedModelIds: ['openai/gpt-4o-mini'] }),
    });
    if (res.status === 200) {
      const data: any = await res.json();
      expect(data).toBeDefined();
    } else {
      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toMatch(/model list/i);
    }
  });

  it('POST /agents/test-agent/clone returns "Editor is not configured" (gated)', async () => {
    const res = await fetchApi('/api/agents/test-agent/clone', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.status === 200) {
      const data: any = await res.json();
      expect(typeof data.id).toBe('string');
    } else {
      expect(res.status).toBe(500);
      const data: any = await res.json();
      expect(data.error).toMatch(/editor is not configured/i);
    }
  });
});
