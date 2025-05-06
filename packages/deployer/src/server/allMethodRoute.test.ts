import { describe, it, expect } from 'vitest';
import type { Mastra } from '@mastra/core';
import { createHonoServer } from './index';

describe('custom route with ALL method', () => {
  it('handles requests of any HTTP method', async () => {
    const mastra = {
      getServer() {
        return {
          apiRoutes: [
            {
              path: '/all',
              method: 'ALL',
              handler: c => c.text(`hit ${c.req.method}`),
            },
          ],
        };
      },
    } as unknown as Mastra;

    const app = await createHonoServer(mastra);

    const getRes = await app.request('/all', { method: 'GET' });
    const postRes = await app.request('/all', { method: 'POST' });
    expect(await getRes.text()).toBe('hit GET');
    expect(await postRes.text()).toBe('hit POST');
  });
});
