import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCodeMode: vi.fn(),
  delegateExecute: vi.fn(),
}));

vi.mock('@mastra/core/tools', async importOriginal => {
  const original = await importOriginal<typeof import('@mastra/core/tools')>();
  return { ...original, createCodeMode: mocks.createCodeMode };
});

import { createMemoryRecallCodeMode } from './memory-code-mode';

describe('Memory-managed Code Mode lazy proxy', () => {
  beforeEach(() => {
    mocks.createCodeMode.mockReset();
    mocks.delegateExecute.mockReset();
  });

  it('loads and caches its standard Code Mode delegate on first execution', async () => {
    mocks.delegateExecute.mockResolvedValue({ success: true, result: 'ok' });
    mocks.createCodeMode.mockReturnValue({
      tool: { execute: mocks.delegateExecute },
      instructions: 'loaded lazily',
    });
    const recall = createTool({
      id: 'recall',
      description: 'Recall memory.',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['messages', 'threads'] } },
        required: ['mode'],
      },
      execute: async () => ({ count: 0 }),
    });

    const proxy = createMemoryRecallCodeMode(recall, true);

    expect(proxy.tool.id).toBe('execute_memory_recall');
    expect(proxy.instructions).toContain('declare function external_recall');
    expect(mocks.createCodeMode).not.toHaveBeenCalled();

    await proxy.tool.execute!({ code: 'return 1' }, {} as never);
    await proxy.tool.execute!({ code: 'return 2' }, {} as never);

    expect(mocks.createCodeMode).toHaveBeenCalledTimes(1);
    expect(mocks.createCodeMode).toHaveBeenCalledWith(
      {
        id: 'execute_memory_recall',
        sandbox: undefined,
        timeout: undefined,
        tools: { recall },
      },
      undefined,
    );
    expect(mocks.delegateExecute).toHaveBeenNthCalledWith(
      1,
      { code: 'return 1' },
      expect.objectContaining({ requestContext: expect.anything() }),
    );
    expect(mocks.delegateExecute).toHaveBeenNthCalledWith(
      2,
      { code: 'return 2' },
      expect.objectContaining({ requestContext: expect.anything() }),
    );
  });

  it('isolates custom transport and timeout configuration per proxy', async () => {
    mocks.delegateExecute.mockResolvedValue({ success: true });
    mocks.createCodeMode.mockReturnValue({ tool: { execute: mocks.delegateExecute }, instructions: 'delegate' });
    const recall = createTool({
      id: 'recall',
      description: 'Recall memory.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({ count: 0 }),
    });
    const transport = { requiresSandbox: false, execute: vi.fn() } as never;
    const configured = createMemoryRecallCodeMode(recall, { timeout: 1_234, transport });
    const defaults = createMemoryRecallCodeMode(recall, true);

    expect(configured.instructions.match(/declare function external_/g)).toHaveLength(1);
    expect(configured.instructions).toContain('declare function external_recall');

    await configured.tool.execute!({ code: 'return 1' }, {} as never);
    await defaults.tool.execute!({ code: 'return 2' }, {} as never);

    expect(mocks.createCodeMode).toHaveBeenNthCalledWith(
      1,
      {
        id: 'execute_memory_recall',
        sandbox: undefined,
        timeout: 1_234,
        tools: { recall },
      },
      transport,
    );
    expect(mocks.createCodeMode).toHaveBeenNthCalledWith(
      2,
      {
        id: 'execute_memory_recall',
        sandbox: undefined,
        timeout: undefined,
        tools: { recall },
      },
      undefined,
    );
  });
});
