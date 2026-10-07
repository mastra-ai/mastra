import { tmpdir } from 'node:os';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../../workspace/constants';
import { LocalFilesystem } from '../../workspace/filesystem';
import { Workspace } from '../../workspace/workspace';
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

    // Converting child tools per call leaks schemas into zod's global registry (#26160)
    expect(getChildTools).not.toHaveBeenCalled();
    expect(tools['agent-child']).toMatchObject({ backgroundConfig: { enabled: true } });
  });

  it('derives background config from sub-agent default toolsets', async () => {
    const model = new MockLanguageModelV2();
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
      defaultOptions: {
        toolsets: {
          extra: {
            work: createTool({
              id: 'work',
              description: 'Do work.',
              inputSchema: z.object({}),
              execute: async () => ({}),
              background: { enabled: true },
            }),
          },
        },
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

    expect(getChildTools).not.toHaveBeenCalled();
    expect(tools['agent-child']).toMatchObject({ backgroundConfig: { enabled: true } });
  });

  it('ignores assigned background tools overridden by a same-named default toolset tool', async () => {
    const model = new MockLanguageModelV2();
    const makeWork = (enabled: boolean) =>
      createTool({
        id: 'work',
        description: 'Do work.',
        inputSchema: z.object({}),
        execute: async () => ({}),
        background: { enabled },
      });
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
      tools: { work: makeWork(true) },
      defaultOptions: { toolsets: { extra: { work: makeWork(false) } } },
    });
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to the child.',
      model,
      agents: { child },
    });

    const tools = await parent.getToolsForExecution({ backgroundTaskEnabled: true });

    expect((tools['agent-child'] as any).backgroundConfig).toBeUndefined();
  });

  it('propagates background eligibility from nested sub-agents without converting their tools', async () => {
    const model = new MockLanguageModelV2();
    const grandchild = new Agent({
      id: 'grandchild',
      name: 'grandchild',
      instructions: 'Do the work.',
      model,
      tools: {
        work: createTool({
          id: 'work',
          description: 'Do work.',
          inputSchema: z.object({}),
          execute: async () => ({}),
          background: { enabled: true },
        }),
      },
    });
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Delegate to the grandchild.',
      model,
      agents: { grandchild },
    });
    const getChildTools = vi.spyOn(child, 'getToolsForExecution');
    const getGrandchildTools = vi.spyOn(grandchild, 'getToolsForExecution');
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to the child.',
      model,
      agents: { child },
    });

    const tools = await parent.getToolsForExecution({ backgroundTaskEnabled: true });

    expect(getChildTools).not.toHaveBeenCalled();
    expect(getGrandchildTools).not.toHaveBeenCalled();
    expect(tools['agent-child']).toMatchObject({ backgroundConfig: { enabled: true } });
  });

  it.each([
    { label: 'derives', enabled: true, expected: { enabled: true } },
    { label: 'ignores disabled', enabled: false, expected: undefined },
  ])('$label background-enabled sub-agent workspace tools without building them', async ({ enabled, expected }) => {
    const model = new MockLanguageModelV2();
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
      workspace: new Workspace({
        id: 'child-workspace',
        filesystem: new LocalFilesystem({ basePath: tmpdir() }),
        tools: { [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: { enabled, background: { enabled: true } } },
      }),
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

    expect(getChildTools).not.toHaveBeenCalled();
    expect((tools['agent-child'] as any).backgroundConfig).toEqual(expected);
  });

  it('ignores background config for workspace tools the workspace cannot provide', async () => {
    const model = new MockLanguageModelV2();
    const child = new Agent({
      id: 'child',
      name: 'child',
      instructions: 'Help the parent.',
      model,
      workspace: new Workspace({
        id: 'child-workspace',
        filesystem: new LocalFilesystem({ basePath: tmpdir() }),
        tools: { [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { background: { enabled: true } } },
      }),
    });
    const parent = new Agent({
      id: 'parent',
      name: 'parent',
      instructions: 'Delegate to the child.',
      model,
      agents: { child },
    });

    const tools = await parent.getToolsForExecution({ backgroundTaskEnabled: true });

    expect((tools['agent-child'] as any).backgroundConfig).toBeUndefined();
  });
});
