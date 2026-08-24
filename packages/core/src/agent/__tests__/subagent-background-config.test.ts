import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
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
});
