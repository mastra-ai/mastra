import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { GET_AGENT_AVATAR_ROUTE } from './avatars';

type Handler = (ctx: Record<string, unknown>) => Promise<Response>;

const handler = GET_AGENT_AVATAR_ROUTE.handler as unknown as Handler;

describe('GET /agents/:agentId/avatar', () => {
  it('throws 404 when no avatar store is configured', async () => {
    await expect(handler({ agentId: 'agent-1', mastra: { getAvatarStore: () => undefined } })).rejects.toThrow(
      HTTPException,
    );
  });

  it('throws 404 when no avatar is stored for the agent', async () => {
    await expect(
      handler({
        agentId: 'agent-1',
        mastra: { getAvatarStore: () => ({ get: vi.fn(async () => null) }) },
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('streams stored bytes with the stored mime type', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await handler({
      agentId: 'agent-1',
      mastra: {
        getAvatarStore: () => ({
          get: vi.fn(async (id: string) => {
            expect(id).toBe('agent-1');
            return { bytes, mime: 'image/png' };
          }),
        }),
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe(String(bytes.byteLength));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(bytes));
  });
});
