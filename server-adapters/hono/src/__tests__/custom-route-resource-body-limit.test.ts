import { Mastra } from '@mastra/core';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { MastraServer } from '../index';

async function setup(bodyLimitOptions?: { maxSize: number; onError: (err: unknown) => unknown }) {
  const authorizeUserResource = vi.fn(async () => true);
  const handler = vi.fn(async (c: any) => c.json({ resource: c.get('requestContext').get(MASTRA_RESOURCE_ID_KEY) }));
  const mastra = new Mastra({
    logger: false,
    server: {
      auth: {
        authenticateToken: async () => ({ id: 'u1' }),
        authorizeUser: () => true,
        mapUserToResourceId: () => 'mapped',
        authorizeUserResource,
      } as any,
      apiRoutes: [{ method: 'POST', path: '/custom', requiresAuth: true, handler }],
    },
  });
  const app = new Hono();
  await new MastraServer({ app, mastra, bodyLimitOptions } as any).init();
  return { app, authorizeUserResource, handler };
}

const post = (app: Hono, body: string, headers: Record<string, string> = {}) =>
  app.request('http://localhost/custom', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer t', ...headers },
    body,
  });

describe('custom-route resource check body limit', () => {
  const limits = { maxSize: 64, onError: (err: unknown) => err };

  it('does not read a body over the configured limit, so its resource id is never approved', async () => {
    const { app, authorizeUserResource, handler } = await setup(limits);
    const response = await post(app, JSON.stringify({ resourceId: 'session-r', pad: 'x'.repeat(200) }), {
      'content-length': '300',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resource: 'mapped' });
    expect(authorizeUserResource).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('trusts a declared content-length over the limit without reading the body', async () => {
    const { app, authorizeUserResource } = await setup(limits);
    const response = await post(app, JSON.stringify({ resourceId: 'session-r' }), { 'content-length': '300' });
    expect(response.status).toBe(200);
    expect(authorizeUserResource).not.toHaveBeenCalled();
  });

  it('stops reading at the limit when content-length is absent (streamed body)', async () => {
    const { app, authorizeUserResource } = await setup(limits);
    const bytes = new TextEncoder().encode(JSON.stringify({ resourceId: 'session-r', pad: 'x'.repeat(200) }));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const response = await app.request(
      new Request('http://localhost/custom', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: stream,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resource: 'mapped' });
    expect(authorizeUserResource).not.toHaveBeenCalled();
  });

  it('still reads a body within the limit for the resource check', async () => {
    const { app, authorizeUserResource } = await setup(limits);
    const response = await post(app, JSON.stringify({ resourceId: 'session-r' }));
    expect(response.status).toBe(200);
    expect(authorizeUserResource).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1' }),
      'session-r',
      expect.anything(),
    );
  });

  it('changes nothing when no limit is configured', async () => {
    const { app, authorizeUserResource } = await setup();
    const response = await post(app, JSON.stringify({ resourceId: 'session-r', pad: 'x'.repeat(200) }));
    expect(response.status).toBe(200);
    expect(authorizeUserResource).toHaveBeenCalledOnce();
  });
});

describe('custom-route resource selector conflict', () => {
  it('rejects a request whose query and body name different resources', async () => {
    const { app, authorizeUserResource, handler } = await setup();
    authorizeUserResource.mockImplementation(async (_user: unknown, resourceId: string) => resourceId === 'r-b');
    const response = await app.request('http://localhost/custom?resourceId=r-a', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: JSON.stringify({ resourceId: 'r-b' }),
    });
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(authorizeUserResource).not.toHaveBeenCalled();
  });

  it('rejects a request that repeats the query resource id with different values', async () => {
    const { app, authorizeUserResource, handler } = await setup();
    authorizeUserResource.mockImplementation(async (_user: unknown, resourceId: string) => resourceId === 'r-b');
    const response = await app.request('http://localhost/custom?resourceId=r-a&resourceId=r-b', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
    });
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    expect(authorizeUserResource).not.toHaveBeenCalled();
  });

  it('allows a request whose query and body name the same approved resource', async () => {
    const { app, authorizeUserResource, handler } = await setup();
    authorizeUserResource.mockImplementation(async (_user: unknown, resourceId: string) => resourceId === 'r-b');
    const response = await app.request('http://localhost/custom?resourceId=r-b', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: JSON.stringify({ resourceId: 'r-b' }),
    });
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(authorizeUserResource).toHaveBeenCalledOnce();
  });
});
