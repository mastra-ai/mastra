import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { Agent } from '../agent';

describe('sub-agent background config derivation', () => {
  it('does not inspect sub-agent tools when background task dispatch is disabled', async () => {
    const model = new MockLanguageModelV2();
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
    });
    const getChildTools = vi.spyOn(child, 'getToolsForExecution');
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to the child.',
      model,
      agents: { child },
    });

    const tools = await parent.getToolsForExecution({});

    expect(tools).toHaveProperty('agent-child');
    expect(getChildTools).not.toHaveBeenCalled();
  });

  it('derives sub-agent background config when background task dispatch is enabled', async () => {
    const model = new MockLanguageModelV2();
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
      tools: {
        work: createTool({
          id: 'work',
          description: 'Do work.',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          execute: async () => ({ done: true }),
          background: { enabled: true },
        }),
      },
    });
    const getChildTools = vi.spyOn(child, 'getToolsForExecution');
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to the child.',
      model,
      agents: { child },
    });

    const tools = await parent.getToolsForExecution({ backgroundTaskEnabled: true });

    expect(getChildTools).toHaveBeenCalledWith(expect.objectContaining({ backgroundTaskEnabled: true }));
    expect(tools['agent-child']).toMatchObject({ backgroundConfig: { enabled: true } });
  });
});
