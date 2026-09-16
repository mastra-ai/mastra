import { describe, it, expect, vi } from 'vitest';
import { createScorer } from '../../evals';
import type { MastraScorer } from '../../evals';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { createSkill } from '../../skills';
import type { InlineSkill } from '../../skills/types';
import { createTool } from '../../tools';
import { Workspace, LocalFilesystem } from '../../workspace';
import { Agent } from '../agent';
import { assembleAgentFromFsEntry, agentConfig, agentInstructions, MAX_FS_SUBAGENT_DEPTH } from './index';
import type { FsAgentToolEntry, FsAgentEntry } from './index';

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

function makeScorer(id: string): MastraScorer<any, any, any, any> {
  return createScorer({ id, name: id, description: `scorer ${id}` }).generateScore(() => 1);
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

describe('agentInstructions', () => {
  it('returns a static value unchanged (identity)', () => {
    expect(agentInstructions('be helpful')).toBe('be helpful');
  });

  it('returns a dynamic value unchanged (identity)', () => {
    const instructions = () => 'be helpful';
    expect(agentInstructions(instructions)).toBe(instructions);
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

  it('throws when neither instructions file nor config.instructions present', () => {
    expect(() =>
      assembleAgentFromFsEntry({
        name: 'broken',
        config: { model: 'openai/gpt-4o' },
      }),
    ).toThrow(/missing instructions/i);
  });

  describe('instructions.ts', () => {
    it('uses a static instructions.ts export', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructions: 'from module',
      });
      expect(await agent.getInstructions()).toBe('from module');
    });

    it('resolves a dynamic instructions.ts export per request', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructions: ({ requestContext }) => `tier: ${requestContext.get('tier') ?? 'standard'}`,
      });

      const requestContext = new RequestContext();
      requestContext.set('tier', 'premium');

      expect(await agent.getInstructions({ requestContext })).toBe('tier: premium');
      expect(await agent.getInstructions({ requestContext: new RequestContext() })).toBe('tier: standard');
    });

    it('accepts a system message object', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructions: { role: 'system', content: 'from message' },
      });
      expect(await agent.getInstructions()).toEqual({ role: 'system', content: 'from message' });
    });

    it('lets instructions.ts win over instructions.md, with a warning', async () => {
      const onWarn = vi.fn();
      const agent = assembleAgentFromFsEntry(
        {
          name: 'a',
          config: { model: 'openai/gpt-4o' },
          instructions: 'from module',
          instructionsMd: 'from md',
        },
        { onWarn },
      );

      expect(await agent.getInstructions()).toBe('from module');
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('instructions.ts wins'));
    });

    it('lets instructions.ts win over a static config.instructions', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o', instructions: 'from config' },
        instructions: 'from module',
      });
      expect(await agent.getInstructions()).toBe('from module');
    });

    it('lets a dynamic config.instructions win over instructions.ts, with a warning', async () => {
      const onWarn = vi.fn();
      const agent = assembleAgentFromFsEntry(
        {
          name: 'a',
          config: { model: 'openai/gpt-4o', instructions: () => 'dynamic config' },
          instructions: 'from module',
        },
        { onWarn },
      );

      expect(await agent.getInstructions()).toBe('dynamic config');
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('defined in both config.ts and instructions.ts'));
    });

    it('satisfies the instructions requirement on its own', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructions: 'only module',
      });
      expect(await agent.getInstructions()).toBe('only module');
    });

    it('accepts an array of strings and system messages', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructions: ['be helpful', { role: 'system', content: 'be brief' }],
      });
      expect(await agent.getInstructions()).toEqual(['be helpful', { role: 'system', content: 'be brief' }]);
    });

    it('throws when the default export is not a usable instructions value', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'broken',
          config: { model: 'openai/gpt-4o' },
          instructions: { prompt: 'wrong shape' } as never,
        }),
      ).toThrow(/must default-export a string, a system message, an array of either, or a function/i);
    });

    // Every one of these reaches the model as an empty string, so the container
    // being the right shape isn't enough to call the export usable.
    it.each([
      ['an array of non-messages', [123, 456], /array holding something other than strings or system messages/i],
      ['an empty array', [], /an empty array/i],
      ['a system message with non-string content', { role: 'system', content: 42 }, /but got object/i],
      ['a message inside an array with non-string content', [{ role: 'system', content: 42 }], /array holding/i],
    ])('throws for %s', (_label, instructions, expected) => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'broken',
          config: { model: 'openai/gpt-4o' },
          instructions: instructions as never,
        }),
      ).toThrow(expected);
    });

    // A null default export is a mistake in a file whose only job is to export
    // instructions, so it must not read as "no instructions.ts here" and send
    // the author chasing the missing-instructions error instead.
    it('rejects a null default export rather than falling back', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'broken',
          config: { model: 'openai/gpt-4o' },
          instructions: null as never,
          instructionsMd: 'from md',
        }),
      ).toThrow(/but got null/i);
    });

    // Same reasoning as the null case, but this one can't be caught by checking
    // the value: codegen sets the key only when the file exists, so presence has
    // to come from the key and an `undefined` export stays a broken file.
    it('rejects an undefined default export rather than falling back', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'broken',
          config: { model: 'openai/gpt-4o' },
          instructions: undefined,
          instructionsMd: 'from md',
        }),
      ).toThrow(/but got undefined/i);
    });

    it('still resolves instructions.md when no instructions.ts was discovered', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'from md',
      });
      expect(await agent.getInstructions()).toBe('from md');
    });

    // Presence means a file was discovered for this agent, so it has to be an
    // own key. An inherited one would let a prototype speak for the directory.
    it('ignores an inherited instructions property', async () => {
      const entry = Object.create({ instructions: 'from prototype' }) as FsAgentEntry;
      Object.assign(entry, {
        name: 'a',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'from md',
      });

      expect(await assembleAgentFromFsEntry(entry).getInstructions()).toBe('from md');
    });
  });

  // The dynamic config wins over either file, so ignoring the markdown silently
  // would leave the same blind spot the instructions.ts collision warns about.
  it('warns when a dynamic config.instructions overrides instructions.md', async () => {
    const onWarn = vi.fn();
    const agent = assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', instructions: () => 'dynamic config' },
        instructionsMd: 'from md',
      },
      { onWarn },
    );

    expect(await agent.getInstructions()).toBe('dynamic config');
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('defined in both config.ts and instructions.md'));
  });

  it('names both files when a dynamic config.instructions overrides each of them', () => {
    const onWarn = vi.fn();
    assembleAgentFromFsEntry(
      {
        name: 'a',
        config: { model: 'openai/gpt-4o', instructions: () => 'dynamic config' },
        instructions: 'from module',
        instructionsMd: 'from md',
      },
      { onWarn },
    );

    expect(onWarn).toHaveBeenCalledWith(
      expect.stringContaining('defined in config.ts, instructions.ts, and instructions.md'),
    );
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

  it('warns that instructions.ts is ignored when config.ts exports a code-defined Agent', () => {
    const onWarn = vi.fn();
    const coded = new Agent({
      id: 'weather',
      name: 'weather',
      instructions: 'Code-defined.',
      model: 'openai/gpt-4o',
    });

    const result = assembleAgentFromFsEntry({ name: 'weather', config: coded, instructions: 'ignored' }, { onWarn });

    expect(result).toBe(coded);
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('instructions.ts is ignored'));
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

    it('does not attach the default workspace when config sets workspace to undefined', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o', workspace: undefined },
        instructionsMd: 'hi',
        defaultWorkspaceBasePath: '/tmp/mastra-fs/weather',
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

    it('assembles nested subagents recursively', async () => {
      const parent = assembleAgentFromFsEntry({
        name: 'supervisor',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        subagents: [
          {
            ...childEntry('researcher', 'Researches topics.'),
            subagents: [childEntry('grandchild', 'Summarizes findings.')],
          },
        ],
      });

      const agents = await parent.listAgents();
      expect(Object.keys(agents)).toEqual(['researcher']);
      const researcher = await (agents.researcher as Agent).listAgents();
      expect(Object.keys(researcher)).toEqual(['grandchild']);
      const grandchild = await (researcher.grandchild as Agent).listAgents();
      expect(Object.keys(grandchild)).toEqual([]);
    });

    it(`warns and ignores subagents nested deeper than MAX_FS_SUBAGENT_DEPTH (${MAX_FS_SUBAGENT_DEPTH})`, async () => {
      const onWarn = vi.fn();

      // Build a chain one level deeper than the cap: depth 1..MAX+1.
      let entry: FsAgentEntry = childEntry(`level${MAX_FS_SUBAGENT_DEPTH + 1}`, 'Too deep.');
      for (let depth = MAX_FS_SUBAGENT_DEPTH; depth >= 1; depth--) {
        entry = { ...childEntry(`level${depth}`, `Level ${depth}.`), subagents: [entry] };
      }

      const parent = assembleAgentFromFsEntry(
        {
          name: 'supervisor',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          subagents: [entry],
        },
        { onWarn },
      );

      // Walk down the chain: every level up to the cap is present.
      let current = parent;
      for (let depth = 1; depth <= MAX_FS_SUBAGENT_DEPTH; depth++) {
        const agents = await current.listAgents();
        expect(Object.keys(agents)).toEqual([`level${depth}`]);
        current = agents[`level${depth}`] as Agent;
      }

      // The level past the cap was dropped with a warning.
      const deepest = await current.listAgents();
      expect(Object.keys(deepest)).toEqual([]);
      expect(onWarn).toHaveBeenCalledWith(
        expect.stringContaining(`nest ${MAX_FS_SUBAGENT_DEPTH} levels below a top-level agent`),
      );
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

  describe('scorers', () => {
    it('wires discovered scorers keyed by filename slug into the agent', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        scorers: [
          { key: 'relevance', scorer: makeScorer('relevance') },
          { key: 'accuracy', scorer: makeScorer('accuracy') },
        ],
      });

      const scorers = await agent.listScorers();
      expect(Object.keys(scorers).sort()).toEqual(['accuracy', 'relevance']);
      expect(scorers.relevance.scorer.id).toBe('relevance');
    });

    it('accepts a { scorer, sampling } entry as the discovered default export', async () => {
      const agent = assembleAgentFromFsEntry({
        name: 'weather',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        scorers: [
          { key: 'relevance', scorer: { scorer: makeScorer('relevance'), sampling: { type: 'ratio', rate: 0.5 } } },
        ],
      });

      const scorers = await agent.listScorers();
      expect(scorers.relevance.scorer.id).toBe('relevance');
      expect(scorers.relevance.sampling).toEqual({ type: 'ratio', rate: 0.5 });
    });

    it('config.scorers wins on key collision with a warning', async () => {
      const onWarn = vi.fn();
      const fromConfig = makeScorer('relevance');
      const agent = assembleAgentFromFsEntry(
        {
          name: 'weather',
          config: { model: 'openai/gpt-4o', scorers: { relevance: { scorer: fromConfig } } },
          instructionsMd: 'hi',
          scorers: [{ key: 'relevance', scorer: makeScorer('relevance') }],
        },
        { onWarn },
      );

      const scorers = await agent.listScorers();
      expect(scorers.relevance.scorer).toBe(fromConfig);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('config.scorers wins'));
    });

    it('a dynamic (function) config.scorers wins wholesale and discovered scorers are ignored', async () => {
      const onWarn = vi.fn();
      const dynamicScorer = makeScorer('dynamic');
      const agent = assembleAgentFromFsEntry(
        {
          name: 'weather',
          config: {
            model: 'openai/gpt-4o',
            scorers: () => ({ dynamic: { scorer: dynamicScorer } }),
          },
          instructionsMd: 'hi',
          scorers: [{ key: 'relevance', scorer: makeScorer('relevance') }],
        },
        { onWarn },
      );

      const scorers = await agent.listScorers();
      expect(Object.keys(scorers)).toEqual(['dynamic']);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('config.scorers is a function'));
    });

    it('warns and ignores scorers/ when config.ts exports a new Agent()', () => {
      const onWarn = vi.fn();
      const coded = new Agent({
        id: 'support',
        name: 'support',
        instructions: 'Code-defined.',
        model: 'openai/gpt-4o',
      });

      const result = assembleAgentFromFsEntry(
        { name: 'support', config: coded, scorers: [{ key: 'relevance', scorer: makeScorer('relevance') }] },
        { onWarn },
      );

      expect(result).toBe(coded);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('scorers/ are ignored'));
    });
  });

  describe('schedules', () => {
    const heartbeat = { cron: '*/5 * * * *', prompt: 'Check system health and report any failures.' };

    it('attaches discovered schedules with their path-derived keys', () => {
      const agent = assembleAgentFromFsEntry({
        name: 'support',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        schedules: [
          { key: 'heartbeat', schedule: heartbeat },
          { key: 'billing/sweep', schedule: { cron: '0 3 * * *', prompt: 'Sweep unpaid invoices.' } },
        ],
      });

      expect(agent.getDeclaredSchedules().map(s => s.key)).toEqual(['heartbeat', 'billing/sweep']);
      expect(agent.getDeclaredSchedules()[0]!.definition).toBe(heartbeat);
    });

    it('defaults to no declared schedules', () => {
      const agent = assembleAgentFromFsEntry({
        name: 'support',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
      });

      expect(agent.getDeclaredSchedules()).toEqual([]);
    });

    it('accepts a handler-mode schedule with no prompt', () => {
      const agent = assembleAgentFromFsEntry({
        name: 'support',
        config: { model: 'openai/gpt-4o' },
        instructionsMd: 'hi',
        schedules: [{ key: 'sweep', schedule: { cron: '0 3 * * *', handler: async () => ({ prompt: 'go' }) } }],
      });

      expect(agent.getDeclaredSchedules()).toHaveLength(1);
    });

    it('throws on an invalid schedule definition, naming the file', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'support',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          schedules: [{ key: 'broken', schedule: { cron: 'nope', prompt: 'hi' } }],
        }),
      ).toThrowError(/agents\/support\/schedules\/broken/);
    });

    it('throws when two files resolve to the same schedule key', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'support',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          schedules: [
            { key: 'heartbeat', schedule: heartbeat },
            { key: 'heartbeat', schedule: heartbeat },
          ],
        }),
      ).toThrowError(/duplicate schedule "heartbeat"/);
    });

    it('throws when a subagent declares schedules', () => {
      expect(() =>
        assembleAgentFromFsEntry({
          name: 'parent',
          config: { model: 'openai/gpt-4o' },
          instructionsMd: 'hi',
          subagents: [
            {
              name: 'child',
              config: { model: 'openai/gpt-4o', description: 'child agent' },
              instructionsMd: 'hi',
              schedules: [{ key: 'heartbeat', schedule: heartbeat }],
            },
          ],
        }),
      ).toThrowError(/only supported on root agents/);
    });

    it('warns and ignores schedules/ when config.ts exports a new Agent()', () => {
      const onWarn = vi.fn();
      const coded = new Agent({
        id: 'support',
        name: 'support',
        instructions: 'Code-defined.',
        model: 'openai/gpt-4o',
      });

      const result = assembleAgentFromFsEntry(
        { name: 'support', config: coded, schedules: [{ key: 'heartbeat', schedule: heartbeat }] },
        { onWarn },
      );

      expect(result).toBe(coded);
      expect(result.getDeclaredSchedules()).toEqual([]);
      expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('schedules/ are ignored'));
    });
  });
});
