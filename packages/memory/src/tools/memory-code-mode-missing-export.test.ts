import { createTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mastra/core/tools', async importOriginal => {
  const original = await importOriginal<typeof import('@mastra/core/tools')>();
  return { ...original, createCodeMode: undefined };
});

import { createMemoryRecallCodeMode } from './memory-code-mode';

describe('Memory-managed Code Mode peer compatibility', () => {
  it('reports a missing core factory only on first Code Mode execution', async () => {
    const recall = createTool({
      id: 'recall',
      description: 'Recall memory.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({ count: 0 }),
    });

    expect(() => createMemoryRecallCodeMode(recall, true)).not.toThrow();
    const proxy = createMemoryRecallCodeMode(recall, true);
    expect(proxy.tool.id).toBe('execute_memory_recall');
    expect(proxy.instructions).toContain('external_recall');

    await expect(proxy.tool.execute!({ code: 'return 1' }, {} as never)).rejects.toThrow(
      /requires @mastra\/core to export createCodeMode.*Installed @mastra\/core version: .*Upgrade @mastra\/core/s,
    );
  });
});
