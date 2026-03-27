import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import type { IMastraEditor } from '../editor/types';
import { Mastra } from './index';

describe('Mastra versioned agent lookup', () => {
  it('should require the editor package for versioned getAgent lookups', async () => {
    const agent = new Agent({
      id: 'test-agent-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const mastra = new Mastra({
      agents: {
        testAgent: agent,
      },
    });

    await expect(mastra.getAgent('testAgent', { versionId: 'version-123' })).rejects.toThrow(
      'Versioned agent lookup requires the editor package to be configured',
    );
  });

  it('should apply stored overrides for getAgent lookups by version id', async () => {
    const agent = new Agent({
      id: 'test-agent-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const applyStoredOverrides = vi.fn(async (inputAgent: Agent) => inputAgent);
    const registerWithMastra = vi.fn();

    const editor: IMastraEditor = {
      registerWithMastra,
      agent: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        clone: vi.fn(),
        applyStoredOverrides,
      },
      mcp: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      mcpServer: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      prompt: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        preview: vi.fn(),
      },
      scorer: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        resolve: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      skill: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      getToolProvider: vi.fn(),
      getToolProviders: vi.fn().mockReturnValue({}),
      getProcessorProvider: vi.fn(),
      getProcessorProviders: vi.fn().mockReturnValue({}),
    };

    const mastra = new Mastra({
      agents: {
        testAgent: agent,
      },
      editor,
    });

    const resolved = await mastra.getAgent('testAgent', { versionId: 'version-123' });

    expect(resolved).toBe(agent);
    expect(registerWithMastra).toHaveBeenCalledWith(mastra);
    expect(applyStoredOverrides).toHaveBeenCalledWith(agent, { versionId: 'version-123' });
  });

  it('should default status lookups to published for getAgentById', async () => {
    const agent = new Agent({
      id: 'test-agent-id',
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: 'openai/gpt-4o',
    });

    const applyStoredOverrides = vi.fn(async (inputAgent: Agent) => inputAgent);

    const editor: IMastraEditor = {
      registerWithMastra: vi.fn(),
      agent: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        clone: vi.fn(),
        applyStoredOverrides,
      },
      mcp: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      mcpServer: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      prompt: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        preview: vi.fn(),
      },
      scorer: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
        resolve: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      skill: {
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        listResolved: vi.fn(),
        clearCache: vi.fn(),
      },
      getToolProvider: vi.fn(),
      getToolProviders: vi.fn().mockReturnValue({}),
      getProcessorProvider: vi.fn(),
      getProcessorProviders: vi.fn().mockReturnValue({}),
    };

    const mastra = new Mastra({
      agents: {
        testAgent: agent,
      },
      editor,
    });

    const resolved = await mastra.getAgentById('test-agent-id', {});

    expect(resolved).toBe(agent);
    expect(applyStoredOverrides).toHaveBeenCalledWith(agent, { status: 'published' });
  });
});
