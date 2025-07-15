import type { Tool, Mastra } from '@mastra/core';
import { describe, it, expect, vi } from 'vitest';
import { createHonoServer } from './index';

vi.mock('hono', () => ({
  Hono: vi.fn(() => ({
    use: vi.fn(),
    onError: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    all: vi.fn(),
    patch: vi.fn(),
  })),
}));

const mockMastra: Partial<Mastra> = {
  getServer: vi.fn().mockReturnValue({}),
};

describe('createHonoServer', () => {
  it('should use tools from options if provided', async () => {
    const customTools = {
      foo: vi.mockObject<Tool>({ id: 'example-tool', description: 'example tool' }),
      bar: vi.mockObject<Tool>({ id: 'tool-bar', description: 'bar' }),
    };
    let app = createHonoServer(mockMastra as any, { tools: customTools });
    await expect(app).resolves.not.toThrow();
    expect(app).toBeDefined();
  });

  it('should use empty object as tools if not provided', async () => {
    let app = createHonoServer(mockMastra as any);
    await expect(app).resolves.not.toThrow();
    expect(app).toBeDefined();
  });
});
