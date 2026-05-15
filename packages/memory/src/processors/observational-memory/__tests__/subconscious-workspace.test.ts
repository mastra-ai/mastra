import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { Subconscious } from '../subconscious';

function createModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
  });
}

async function createWorkspace(tools?: ConstructorParameters<typeof Workspace>[0]['tools']) {
  const basePath = await mkdtemp(join(tmpdir(), 'subconscious-workspace-'));
  return new Workspace({ filesystem: new LocalFilesystem({ basePath }), tools });
}

describe('Subconscious workspace tools', () => {
  it('generated psyche agents receive safe workspace tools', async () => {
    const workspace = await createWorkspace();
    const subconscious = new Subconscious({ model: createModel(), workspace });

    const tools = await subconscious.critic.agent.listTools({ requestContext: new RequestContext() });

    expect(Object.keys(tools)).toContain('mastra_workspace_read_file');
    expect(Object.keys(tools)).toContain('mastra_workspace_write_file');
    expect(Object.keys(tools)).toContain('mastra_workspace_edit_file');
    expect(Object.keys(tools)).toContain('mastra_workspace_mkdir');
    expect(Object.keys(tools)).not.toContain('mastra_workspace_delete');
    expect(Object.keys(tools)).not.toContain('mastra_workspace_execute_command');
  });

  it('allows dangerous workspace tools only when explicitly enabled', async () => {
    const workspace = await createWorkspace();
    const subconscious = new Subconscious({
      model: createModel(),
      workspace,
      workspaceTools: {
        mastra_workspace_delete: { enabled: true },
      },
    });

    const tools = await subconscious.critic.agent.listTools({ requestContext: new RequestContext() });

    expect(Object.keys(tools)).toContain('mastra_workspace_delete');
  });

  it('merges user-provided tools with workspace tools', async () => {
    const workspace = await createWorkspace();
    const customTool = {
      id: 'custom_tool',
      description: 'custom',
      inputSchema: undefined,
      execute: async () => 'ok',
    } as any;
    const subconscious = new Subconscious({
      model: createModel(),
      workspace,
      psyches: { critic: { tools: { custom_tool: customTool } } },
    });

    const tools = await subconscious.critic.agent.listTools({ requestContext: new RequestContext() });

    expect(Object.keys(tools)).toContain('mastra_workspace_read_file');
    expect(Object.keys(tools)).toContain('custom_tool');
  });

  it('does not mutate supplied custom agents', async () => {
    const workspace = await createWorkspace();
    const agent = new Agent({
      id: 'custom-critic',
      name: 'custom-critic',
      instructions: 'custom',
      model: createModel(),
    });
    const subconscious = new Subconscious({
      model: createModel(),
      workspace,
      psyches: { critic: { agent } },
    });

    const tools = await agent.listTools({ requestContext: new RequestContext() });

    expect(subconscious.critic.agent).toBe(agent);
    expect(Object.keys(tools)).toHaveLength(0);
    await expect(subconscious.workspaceToolsFor('critic', new RequestContext())).resolves.toEqual(
      expect.objectContaining({ mastra_workspace_read_file: expect.any(Object) }),
    );
  });

  it('returns read-oriented workspace tools for the main agent by default', async () => {
    const workspace = await createWorkspace();
    const subconscious = new Subconscious({ model: createModel(), workspace });

    const tools = await subconscious.workspaceToolsForMainAgent(new RequestContext(), { agentId: 'reese' });

    expect(Object.keys(tools)).toContain('mastra_workspace_read_file');
    expect(Object.keys(tools)).toContain('mastra_workspace_list_files');
    expect(Object.keys(tools)).toContain('mastra_workspace_file_stat');
    expect(Object.keys(tools)).not.toContain('mastra_workspace_write_file');
    expect(Object.keys(tools)).not.toContain('mastra_workspace_edit_file');
  });

  it('mentions the psyche workspace domain in generated instructions', async () => {
    const workspace = await createWorkspace();
    const subconscious = new Subconscious({ model: createModel(), workspace });

    expect(subconscious.critic.agentInstructions).toContain('review/');
    expect(subconscious.learner.agentInstructions).toContain('skills/');
    expect(subconscious.learner.agentInstructions).not.toContain('knowledge/');
    expect(subconscious.get('integrator').agentInstructions).toContain('knowledge/');
  });
});
