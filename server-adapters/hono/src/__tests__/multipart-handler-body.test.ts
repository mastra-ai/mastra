import { Mastra } from '@mastra/core';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

describe('multipart handler request body', () => {
  it('leaves multipart data readable for a registered route handler', async () => {
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    const route: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/upload',
      responseType: 'json',
      handler: async ({ request }) => {
        const form = await request.formData();
        const file = form.get('file');
        return { model: form.get('model'), file: file instanceof File ? await file.text() : null };
      },
    };
    app.use('*', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });

    const form = new FormData();
    form.set('model', 'openai/whisper');
    form.set('file', new File(['spoken words'], 'dictation.webm', { type: 'audio/webm' }));
    const response = await app.request('http://localhost/upload', { method: 'POST', body: form });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ model: 'openai/whisper', file: 'spoken words' });
  });
});
