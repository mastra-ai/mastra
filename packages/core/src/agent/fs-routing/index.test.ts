import { describe, it, expect, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
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

  describe('subagents', () => {
    function childEntry(name: string, description: string) {
      return {
        name,
        config: { model: 'openai/gpt-4o' as const, description },
        instructionsMd: `You are the ${name} subagent.`,
      };
    }

    it('assembles discovered subagents and wires them into the parent agents map', async () => {
      const parent = assembleAgentFromFsEntry({
        name: 'supervisor',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'Delegate to specialists.',
        subagents: [childEntry('researcher', 'Researches topics.'), childEntry('writer', 'Writes drafts.')],
      });

      const agents = await parent.listAgents();
      expect(Object.keys(agents).sort()).toEqual(['researcher', 'writer']);
      expect(agents.researcher!.getDescription()).toBe('Researches topics.');
      expect(await (agents.researcher as Agent).getInstructions()).toBe('You are the researcher subagent.');
    });

    it('throws when a subagent has no description', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'supervisor',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          subagents: [
            {
              name: 'researcher',
              config: { model: 'openai/gpt-4o' },
              instructionsMd: 'You research.',
            },
          ],
        }),
      ).toThrow(/requires a non-empty 'description'/);
    });

    it('throws when a subagent id collides with a sibling tool key', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'supervisor',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          tools: [makeTool('researcher')],
          subagents: [childEntry('researcher', 'Researches topics.')],
        }),
      ).toThrow(/collides with a tool/);
    });

    it('throws on duplicate subagent ids', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'supervisor',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          subagents: [childEntry('researcher', 'First.'), childEntry('researcher', 'Second.')],
        }),
      ).toThrow(/duplicate subagent/);
    });

    it('lets config.agents win on id collision and warns', async () => {
      const onWarn = vi.fn();
      const configChild = new Agent({
        id: 'researcher',
        name: 'researcher',
        description: 'Config version of the researcher.',
        instructions: 'config researcher',
        model: 'openai/gpt-4o',
      });

      const parent = assembleAgentFromFsEntry(
        {
          name: 'supervisor',
          config: { model: 'openai/gpt-4o', agents: { researcher: configChild } },
          instructionsMd: 'hi',
          subagents: [childEntry('researcher', 'FS version.')],
        },
        { onWarn },
      );

      const agents = await parent.listAgents();
      expect(agents.researcher).toBe(configChild);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('researcher'));
    });

    it('warns and ignores discovered subagents when config.agents is a function', async () => {
      const onWarn = vi.fn();
      const dynamicAgents = () => ({});

      assembleAgentFromFsEntry(
        {
          name: 'supervisor',
          config: { model: 'openai/gpt-4o', agents: dynamicAgents },
          instructionsMd: 'hi',
          subagents: [childEntry('researcher', 'FS version.')],
        },
        { onWarn },
      );

      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('function'));
    });

    it('ignores discovered subagents when config.ts exports a new Agent()', async () => {
      const onWarn = vi.fn();
      const coded = new Agent({
        id: 'supervisor',
        name: 'supervisor',
        instructions: 'Code-defined.',
        model: 'openai/gpt-4o',
      });

      const result = assembleAgentFromFsEntry(
        { name: 'supervisor', config: coded, subagents: [childEntry('researcher', 'FS version.')] },
        { onWarn },
      );

      expect(result).toBe(coded);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('subagents'));
    });

    it('ignores a nested subagents/ inside a subagent (one level only)', async () => {
      const parent = assembleAgentFromFsEntry({
        name: 'supervisor',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        subagents: [
          {
            ...childEntry('researcher', 'Researches topics.'),
            subagents: [childEntry('grandchild', 'Should be ignored.')],
          },
        ],
      });

      const agents = await parent.listAgents();
      expect(Object.keys(agents)).toEqual(['researcher']);
      const researcher = await (agents.researcher as Agent).listAgents();
      expect(Object.keys(researcher)).toEqual([]);
    });
  });

  describe('memory', () => {
    it('wires memory.ts onto the assembled agent', async () => {
      const memory = new MockMemory();
      const agent = assembleAgentFromFsEntry({
        name: 'support',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        memory,
      });

      expect(agent.hasOwnMemory()).toBe(true);
      expect(await agent.getMemory()).toBe(memory);
    });

    it('config.memory wins over memory.ts and warns', async () => {
      const onWarn = vi.fn();
      const fromConfig = new MockMemory();
      const fromFile = new MockMemory();

      const agent = assembleAgentFromFsEntry(
        {
          name: 'support',
          config: { model: 'openai/gpt-4o', memory: fromConfig },
          instructionsMd: 'hi',
          memory: fromFile,
        },
        { onWarn },
      );

      expect(await agent.getMemory()).toBe(fromConfig);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('config.memory wins'));
    });

    it('warns and ignores memory.ts when config.ts exports a new Agent()', async () => {
      const onWarn = vi.fn();
      const coded = new Agent({
        id: 'support',
        name: 'support',
        instructions: 'Code-defined.',
        model: 'openai/gpt-4o',
      });
      const fromFile = new MockMemory();

      const result = assembleAgentFromFsEntry({ name: 'support', config: coded, memory: fromFile }, { onWarn });

      expect(result).toBe(coded);
      expect(result.hasOwnMemory()).toBe(false);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('memory.ts is ignored'));
    });

    it('leaves the agent without memory when none is provided', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'support',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
      });

      expect(agent.hasOwnMemory()).toBe(false);
      expect(await agent.getMemory()).toBeUndefined();
    });
  });
});
