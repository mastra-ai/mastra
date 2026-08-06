import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleServerError } from './server-error.js';

function buildApp() {
  const app = new Hono();
  app.onError(handleServerError);
  app.get('/boom', () => {
    throw new Error('db connection refused');
  });
  app.get('/teapot', () => {
    throw new HTTPException(418, { message: 'short and stout' });
  });
  return app;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('handleServerError', () => {
  it('returns structured JSON with the error message instead of an opaque 500', async () => {
    const res = await buildApp().request('/boom');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal_error', message: 'db connection refused' });
  });

  it('logs method, path, and stack server-side', async () => {
    await buildApp().request('/boom');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]![0]);
    expect(logged).toContain('GET /boom failed');
    expect(logged).toContain('db connection refused');
    // Stack trace, not just the message.
    expect(logged).toContain('at ');
  });

  it('passes HTTPException status + message through without logging', async () => {
    const res = await buildApp().request('/teapot');
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ error: 'short and stout' });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
