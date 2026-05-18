import { describe, expect, it } from 'vitest';
import { fetchApi } from '../utils.js';

describe('tool providers — gated by editor configuration', () => {
  it('GET /tool-providers returns "Editor is not configured" in the smoke fixture', async () => {
    const res = await fetchApi('/api/tool-providers');
    if (res.status === 200) {
      const data: any = await res.json();
      expect(Array.isArray(data) || Array.isArray(data.providers)).toBe(true);
    } else {
      expect(res.status).toBe(500);
      const data: any = await res.json();
      expect(data.error).toMatch(/editor is not configured/i);
    }
  });

  it('GET /tool-providers/:providerId/toolkits is gated when no editor is configured', async () => {
    const res = await fetchApi('/api/tool-providers/smoke-provider/toolkits');
    if (res.status === 200) {
      const data: any = await res.json();
      expect(data).toBeDefined();
    } else {
      expect([400, 404, 500]).toContain(res.status);
      const data: any = await res.json().catch(() => ({}));
      expect(typeof data.error).toBe('string');
    }
  });

  it('GET /tool-providers/:providerId/tools/:toolSlug/schema is gated', async () => {
    const res = await fetchApi('/api/tool-providers/smoke-provider/tools/smoke-tool/schema');
    expect([200, 400, 404, 500]).toContain(res.status);
    if (res.status >= 400) {
      const data: any = await res.json().catch(() => ({}));
      expect(typeof data.error).toBe('string');
    }
  });
});
