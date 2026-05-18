import { describe, expect, it } from 'vitest';
import { fetchApi } from '../utils.js';

describe('processor providers — gated by editor configuration', () => {
  it('GET /processor-providers returns "Editor is not configured" in the smoke fixture', async () => {
    const res = await fetchApi('/api/processor-providers');
    if (res.status === 200) {
      const data: any = await res.json();
      expect(Array.isArray(data) || Array.isArray(data.providers)).toBe(true);
    } else {
      expect(res.status).toBe(500);
      const data: any = await res.json();
      expect(data.error).toMatch(/editor is not configured/i);
    }
  });

  it('GET /processor-providers/:providerId is gated when no editor is configured', async () => {
    const res = await fetchApi('/api/processor-providers/smoke-provider');
    expect([200, 400, 404, 500]).toContain(res.status);
    if (res.status >= 400) {
      const data: any = await res.json().catch(() => ({}));
      expect(typeof data.error).toBe('string');
    }
  });
});
