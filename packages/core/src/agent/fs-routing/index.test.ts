import { describe, it, expect, vi } from 'vitest';
import { RequestContext } from '../../request-context';
import { createSkill } from '../../skills';
import type { InlineSkill } from '../../skills/types';
import { createTool } from '../../tools';
import { Workspace, LocalFilesystem } from '../../workspace';
import { Agent } from '../agent';
import { assembleAgentFromFsEntry, agentConfig } from './index';
import type { FsAgentToolEntry } from './index';

function makeTool(id: string): FsAgentToolEntry {
  return {
    key: id,
    tool: createTool({
      id,
      description: `tool ${id}`,
      execute: async () => ({ ok: true }),
    }),
  };
}

function makeSkill(name: string): InlineSkill {
  return createSkill({
    name,
    description: `Use the ${name} skill when relevant.`,
    instructions: `# ${name}\nDo the ${name} thing.`,
  });
}

describe('agentConfig', () => {
  it('returns the config unchanged (identity)', () => {
    const config = { model: 'openai/gpt-4o' as const };
    expect(agentConfig(config)).toBe(config);
  });
});

describe('assembleAgentFromFsEntry', () => {
  it('defaults id/name to the directory name when omitted', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'weather',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'You are the weather agent.',
    });

    expect(agent.id).toBe('weather');
    expect(agent.name).toBe('weather');
    expect(await agent.getInstructions()).toBe('You are the weather agent.');
  });

  it('respects explicit id/name in config over the directory name', () => {
    const agent = assembleAgentFromFsEntry({
      name: 'weather',
      config: { model: 'openai/gpt-4o', id: 'wx', name: 'Weather Pro' },
      instructionsMd: 'hi',
    });

    expect(agent.id).toBe('wx');
    expect(agent.name).toBe('Weather Pro');
  });

  it('uses instructions.md when config has no instructions', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'from md',
    });
    expect(await agent.getInstructions()).toBe('from md');
  });

  it('lets instructions.md win over a static config.instructions', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o', instructions: 'from config' },
      instructionsMd: 'from md',
    });
    expect(await agent.getInstructions()).toBe('from md');
  });

  it('lets a dynamic config.instructions win over instructions.md', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o', instructions: () => 'dynamic' },
      instructionsMd: 'from md',
    });
    expect(await agent.getInstructions()).toBe('dynamic');
  });

  it('falls back to static config.instructions when no md present', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o', instructions: 'only config' },
    });
    expect(await agent.getInstructions()).toBe('only config');
  });

  it('throws when neither instructions.md nor config.instructions present', () => {
    expect(() =>
      assembleAgentFromFsEntry({
        name: 'broken',
        config: { model: 'openai/gpt-4o' },
      }),
    ).toThrow(/missing instructions/i);
  });

  it('throws when model is missing', () => {
    expect(() =>
      assembleAgentFromFsEntry({
        name: 'broken',
        config: {},
        instructionsMd: 'hi',
      }),
    ).toThrow(/missing model/i);
  });

  it('merges discovered tools into the agent', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'hi',
      tools: [makeTool('get_weather'), makeTool('get_forecast')],
    });

    const tools = await agent.listTools();
    expect(Object.keys(tools).sort()).toEqual(['get_forecast', 'get_weather']);
  });

  it('lets config.tools win on key collision and warns', async () => {
    const onWarn = vi.fn();
    const configTool = createTool({
      id: 'get_weather',
      description: 'config version',
      execute: async () => ({ ok: true }),
    });

    const agent = assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', tools: { get_weather: configTool } },
        instructionsMd: 'hi',
        tools: [makeTool('get_weather'), makeTool('get_forecast')],
      },
      { onWarn },
    );

    const tools = await agent.listTools();
    expect(tools.get_weather).toBe(configTool);
    expect(Object.keys(tools).sort()).toEqual(['get_forecast', 'get_weather']);
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('get_weather'));
  });

  it('warns and ignores discovered tools when config.tools is a function', async () => {
    const onWarn = vi.fn();
    const dynamicTools = () => ({});

    assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', tools: dynamicTools },
        instructionsMd: 'hi',
        tools: [makeTool('get_weather')],
      },
      { onWarn },
    );

    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('function'));
  });

  it('uses a code-defined Agent (new Agent()) verbatim instead of re-wrapping it', () => {
    const coded = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'Code-defined.',
      model: 'openai/gpt-4o',
    });

    const result = assembleAgentFromFsEntry({ name: 'weather', config: coded });

    expect(result).toBe(coded);
  });

  it('warns when a code-defined Agent coexists with instructions.md / tools', () => {
    const onWarn = vi.fn();
    const coded = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'Code-defined.',
      model: 'openai/gpt-4o',
    });

    assembleAgentFromFsEntry(
      { name: 'weather', config: coded, instructionsMd: 'ignored', tools: [makeTool('get_weather')] },
      { onWarn },
    );

    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('instructions.md'));
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('tools'));
  });

  it('merges discovered skills into the agent', async () => {
    const agent = assembleAgentFromFsEntry({
      name: 'a',
      config: { model: 'openai/gpt-4o' },
      instructionsMd: 'hi',
      skills: [makeSkill('review'), makeSkill('testing')],
    });

    const skills = await agent.listSkills();
    expect(skills.map(s => s.name).sort()).toEqual(['review', 'testing']);
  });

  it('lets config.skills win on name collision and warns', async () => {
    const onWarn = vi.fn();
    const configSkill = createSkill({
      name: 'review',
      description: 'Config version of the review skill.',
      instructions: '# review\nconfig version',
    });

    const agent = assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', skills: [configSkill] },
        instructionsMd: 'hi',
        skills: [makeSkill('review'), makeSkill('testing')],
      },
      { onWarn },
    );

    const skills = await agent.listSkills();
    expect(skills.map(s => s.name).sort()).toEqual(['review', 'testing']);
    const review = skills.find(s => s.name === 'review');
    expect(review?.description).toBe('Config version of the review skill.');
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('review'));
  });

  it('warns and ignores discovered skills when config.skills is a function', async () => {
    const onWarn = vi.fn();
    const dynamicSkills = () => [];

    assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', skills: dynamicSkills },
        instructionsMd: 'hi',
        skills: [makeSkill('review')],
      },
      { onWarn },
    );

    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('function'));
  });

  it('warns when a code-defined Agent coexists with discovered skills', () => {
    const onWarn = vi.fn();
    const coded = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'Code-defined.',
      model: 'openai/gpt-4o',
    });

    assembleAgentFromFsEntry({ name: 'weather', config: coded, skills: [makeSkill('review')] }, { onWarn });

    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('skills'));
  });

  describe('workspace', () => {
    it('attaches a default workspace when defaultWorkspaceBasePath is provided', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        defaultWorkspaceBasePath: '/tmp/mastra-fs/weather',
      });

      const workspace = await agent.getWorkspace({ requestContext: new RequestContext() });
      expect(workspace).toBeDefined();
      expect(workspace?.name).toBe('weather-workspace');
    });

    it('does not attach a workspace when no basePath and no config workspace', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
      });

      const workspace = await agent.getWorkspace({ requestContext: new RequestContext() });
      expect(workspace).toBeUndefined();
    });

    it('uses workspace.ts over the default workspace', async () => {
      const custom = new Workspace({
        name: 'custom-ws',
        filesystem: new LocalFilesystem({ basePath: '/tmp/mastra-fs/custom' }),
      });

      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        workspace: custom,
        defaultWorkspaceBasePath: '/tmp/mastra-fs/weather',
      });

      const workspace = await agent.getWorkspace({ requestContext: new RequestContext() });
      expect(workspace).toBe(custom);
    });

    it('config.workspace wins over workspace.ts and warns', async () => {
      const onWarn = vi.fn();
      const fromConfig = new Workspace({
        name: 'config-ws',
        filesystem: new LocalFilesystem({ basePath: '/tmp/mastra-fs/config' }),
      });
      const fromFile = new Workspace({
        name: 'file-ws',
        filesystem: new LocalFilesystem({ basePath: '/tmp/mastra-fs/file' }),
      });

      const agent = assembleAgentFromFsEntry(
        {
          name: 'weather',
          config: { model: 'openai/gpt-4o', workspace: fromConfig },
          instructionsMd: 'hi',
          workspace: fromFile,
          defaultWorkspaceBasePath: '/tmp/mastra-fs/weather',
        },
        { onWarn },
      );

      const workspace = await agent.getWorkspace({ requestContext: new RequestContext() });
      expect(workspace).toBe(fromConfig);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('config.workspace wins'));
    });

    it('warns when a code-defined Agent coexists with a discovered workspace.ts', () => {
      const onWarn = vi.fn();
      const coded = new Agent({
        id: 'weather',
        name: 'weather',
        instructions: 'Code-defined.',
        model: 'openai/gpt-4o',
      });
      const fromFile = new Workspace({
        name: 'file-ws',
        filesystem: new LocalFilesystem({ basePath: '/tmp/mastra-fs/file' }),
      });

      assembleAgentFromFsEntry({ name: 'weather', config: coded, workspace: fromFile }, { onWarn });

      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('workspace.ts is ignored'));
    });
  });
});
