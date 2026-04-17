/**
 * Tests for the avatar upload route on stored agents.
 * Stores images as data URLs on metadata.avatarUrl; enforces a 512 KB decoded limit.
 */

import type { Mastra } from '@mastra/core';
import { describe, it, expect, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { UPLOAD_STORED_AGENT_AVATAR_ROUTE } from './stored-agents';
import { createTestServerContext } from './test-utils';

vi.mock('./agent-versions', () => ({
  handleAutoVersioning: vi.fn(async (_s, _id, _f, _exist, updatedAgent) => ({
    agent: updatedAgent,
    versionCreated: false,
  })),
}));

function mockMastra(existing: { id: string; metadata?: Record<string, unknown> } | null) {
  const update = vi.fn(async (input: any) => ({ ...existing, ...input }));
  const agentsStore = {
    getById: vi.fn(async () => existing),
    update,
  };
  const storage = {
    getStore: vi.fn(async (name: string) => (name === 'agents' ? agentsStore : undefined)),
  };
  const mastra = {
    getStorage: () => storage,
  } as unknown as Mastra;
  return { mastra, update, agentsStore };
}

// 1x1 transparent PNG (<1 KB) — valid happy-path avatar
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('POST /stored/agents/:storedAgentId/avatar', () => {
  it('writes avatarUrl onto metadata and returns the data URL', async () => {
    const { mastra, update } = mockMastra({ id: 'a1', metadata: { foo: 'bar' } });

    const result = await UPLOAD_STORED_AGENT_AVATAR_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      storedAgentId: 'a1',
      contentBase64: TINY_PNG_BASE64,
      contentType: 'image/png',
    } as any);

    expect(result.avatarUrl).toMatch(/^data:image\/png;base64,/);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        metadata: expect.objectContaining({ foo: 'bar', avatarUrl: expect.any(String) }),
      }),
    );
  });

  it('returns 404 when the agent does not exist', async () => {
    const { mastra } = mockMastra(null);

    await expect(
      UPLOAD_STORED_AGENT_AVATAR_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        storedAgentId: 'missing',
        contentBase64: TINY_PNG_BASE64,
        contentType: 'image/png',
      } as any),
    ).rejects.toBeInstanceOf(HTTPException);
  });

  it('rejects oversized payloads with 413', async () => {
    const { mastra } = mockMastra({ id: 'a1' });
    // 600 KB of zero bytes, base64-encoded
    const big = Buffer.alloc(600 * 1024, 0).toString('base64');

    await expect(
      UPLOAD_STORED_AGENT_AVATAR_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        storedAgentId: 'a1',
        contentBase64: big,
        contentType: 'image/png',
      } as any),
    ).rejects.toBeInstanceOf(HTTPException);
  });
});
