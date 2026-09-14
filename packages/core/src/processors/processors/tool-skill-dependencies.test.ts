import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { Workspace, LocalFilesystem } from '../../workspace';
import { MessageList } from '../../agent/message-list';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';
import type { ProcessInputStepArgs } from '../index';
import { SkillSearchProcessor } from './skill-search';
import { getSkillReadiness } from './skill-readiness';
import { ToolSearchProcessor } from './tool-search';
import { deriveLoadedNamesFromMessages } from './tool-search-stores';
import { createToolSkillPolicy } from './tool-skill-dependencies';

export function fixture(autoLoad = false, storage: 'context' | 'in-memory' = 'context') {
  const catalog = new Map([
    ['image-generation', { name: 'image-generation', instructions: 'Check the image brief before generating.' }],
    ['image-editing', { name: 'image-editing', instructions: 'Preserve all requested details.' }],
  ]);
  const skills = {
    listNames: vi.fn(async () => [...catalog.keys()]),
    list: vi.fn(async () => [...catalog.values()]),
    get: vi.fn(async (name: string) => catalog.get(name)),
    maybeRefresh: vi.fn(async () => {}),
    search: vi.fn(async () => [...catalog.keys()].map(skillName => ({ skillName, score: 1 }))),
  };
  const skillSearch = new SkillSearchProcessor({ workspace: { skills } as any, trackReadiness: true, ttl: 0 });
  const policy = createToolSkillPolicy({
    generate_image: ['image-generation'],
    edit_image: ['image-generation', 'image-editing'],
    create_artifact: ({ phase, input }) =>
      phase === 'execute' && (input as any)?.type === 'mini_app' ? ['mini-app-builder'] : [],
  });
  const execute = vi.fn(async () => ({ created: true }));
  const tools = Object.fromEntries(
    ['generate_image', 'edit_image', 'plain_tool', 'create_artifact'].map(id => [
      id,
      createTool({ id, description: `${id} image tool`, execute }),
    ]),
  );
  const toolSearch = new ToolSearchProcessor({
    tools,
    toolPolicy: policy,
    search: { autoLoad, topK: 10 },
    storage,
    ttl: 0,
  });
  const context = new RequestContext();
  context.set(MASTRA_THREAD_ID_KEY, 'thread');
  context.set(MASTRA_RESOURCE_ID_KEY, 'user');
  const args = {
    requestContext: context,
    messageList: new MessageList({}),
    messages: [],
    stepNumber: 0,
  } as unknown as ProcessInputStepArgs;
  const step = async () => {
    await skillSearch.processInputStep(args);
    return (await toolSearch.processInputStep(args)).tools as any;
  };
  const loadSkill = async (name: string) => {
    const result = await skillSearch.processInputStep(args);
    return (result.tools as any).load_skill.execute({ skillName: name });
  };
  return { skillSearch, toolSearch, policy, context, args, step, loadSkill, execute, catalog, skills, tools };
}

describe('mandatory skill dependencies', () => {
  it.each(['context', 'in-memory'] as const)(
    'blocks loading, then recovers through native load_skill (%s)',
    async storage => {
      const f = fixture(false, storage);
      let tools = await f.step();
      const search = await tools.search_tools.execute({ query: 'generate_image' });
      expect(search.results.some((r: any) => r.name === 'generate_image')).toBe(true);
      expect(await tools.load_tool.execute({ toolName: 'generate_image' })).toMatchObject({
        success: false,
        dependencyErrors: [
          {
            code: 'MISSING_REQUIRED_SKILL',
            tool: 'generate_image',
            missingSkills: ['image-generation'],
            retryable: true,
          },
        ],
      });
      expect((await f.step()).generate_image).toBeUndefined();
      const nativeSkills = await f.skillSearch.processInputStep(f.args);
      await (nativeSkills.tools as any).load_skill.execute({ skillName: 'image-generation' });
      expect(await tools.load_tool.execute({ toolName: 'generate_image' })).toMatchObject({ success: false });
      tools = await f.step();
      expect(await tools.load_tool.execute({ toolName: 'generate_image' })).toMatchObject({ success: true });
      expect(await (await f.step()).generate_image.execute({})).toEqual({ created: true });
      expect(f.execute).toHaveBeenCalledTimes(1);
    },
  );

  it('blocks auto-loading and does not restore blocked discoveries from history', async () => {
    const f = fixture(true);
    const result = await (await f.step()).search_tools.execute({ query: 'generate_image' });
    expect(result.results.find((r: any) => r.name === 'generate_image')).toMatchObject({
      loaded: false,
      dependencyError: { code: 'MISSING_REQUIRED_SKILL' },
    });
    f.args.messages = [
      {
        content: {
          parts: [{ type: 'tool-invocation', toolInvocation: { toolName: 'search_tools', state: 'result', result } }],
        },
      },
    ] as any;
    expect(deriveLoadedNamesFromMessages(f.args).has('generate_image')).toBe(false);
    expect((await f.step()).generate_image).toBeUndefined();
    await f.loadSkill('image-generation');
    await (await f.step()).search_tools.execute({ query: 'generate_image' });
    expect((await f.step()).generate_image).toBeDefined();
  });

  it('requires all skills, including a skill shared by multiple tools', async () => {
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    expect(await f.policy({ toolName: 'generate_image', requestContext: f.context, phase: 'load' })).toEqual({
      allowed: true,
    });
    expect(await f.policy({ toolName: 'edit_image', requestContext: f.context, phase: 'load' })).toMatchObject({
      error: { missingSkills: ['image-editing'] },
    });
    await f.loadSkill('image-editing');
    await f.step();
    expect(await f.policy({ toolName: 'edit_image', requestContext: f.context, phase: 'execute' })).toEqual({
      allowed: true,
    });
  });

  it('rechecks a captured executor after its skill state has been cleared', async () => {
    const f = fixture(true);
    await f.step();
    await f.loadSkill('image-generation');
    await (await f.step()).search_tools.execute({ query: 'generate_image' });
    const tool = (await f.step()).generate_image;
    f.skillSearch.clearState('thread');
    expect(await tool.execute({})).toMatchObject({ code: 'MISSING_REQUIRED_SKILL' });
    expect(f.execute).not.toHaveBeenCalled();
  });

  it('isolates requests and users even when thread ids match; cold state fails closed', async () => {
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    const other = new RequestContext();
    other.set(MASTRA_THREAD_ID_KEY, 'thread');
    other.set(MASTRA_RESOURCE_ID_KEY, 'user');
    await f.skillSearch.processInputStep({ ...f.args, requestContext: other });
    expect(getSkillReadiness(other)?.readySkills).toEqual([]);
    f.context.set(MASTRA_RESOURCE_ID_KEY, 'other-user');
    expect(getSkillReadiness(f.context)).toBeUndefined();
    expect(
      await f.policy({ toolName: 'generate_image', phase: 'execute', requestContext: new RequestContext() }),
    ).toMatchObject({ allowed: false });
  });

  it('revokes skills removed from the authorized catalog with a non-retryable error', async () => {
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    f.catalog.delete('image-generation');
    await f.step();
    expect(await f.policy({ toolName: 'generate_image', phase: 'execute', requestContext: f.context })).toMatchObject({
      allowed: false,
      error: { code: 'REQUIRED_SKILL_UNAVAILABLE', retryable: false },
    });
  });

  it('keeps unprotected tools unchanged and protects only the shared-tool operation', async () => {
    const f = fixture();
    await f.step();
    expect(await f.policy({ toolName: 'plain_tool', phase: 'execute' })).toEqual({ allowed: true });
    expect(await f.policy({ toolName: 'create_artifact', phase: 'load' })).toEqual({ allowed: true });
    expect(await f.policy({ toolName: 'create_artifact', phase: 'execute', input: { type: 'document' } })).toEqual({
      allowed: true,
    });
    expect(
      await f.policy({
        toolName: 'create_artifact',
        phase: 'execute',
        input: { type: 'mini_app' },
        requestContext: f.context,
      }),
    ).toMatchObject({ allowed: false });
  });

  it('preserves permission filtering on the auto-load path', async () => {
    const f = fixture(true);
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    const filter = vi.fn(({ phase }) => phase !== 'load');
    const search = new ToolSearchProcessor({
      tools: f.tools,
      search: { autoLoad: true },
      toolPolicy: f.policy,
      filter,
      ttl: 0,
    });
    const tools = (await search.processInputStep(f.args)).tools as any;
    await tools.search_tools.execute({ query: 'generate_image' });
    expect((await search.processInputStep(f.args)).tools.generate_image).toBeUndefined();
    expect(filter).toHaveBeenCalledWith(expect.objectContaining({ phase: 'load' }));
  });

  it('makes no catalog calls per dependency check', async () => {
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    f.skills.list.mockClear();
    f.skills.get.mockClear();
    for (let i = 0; i < 10000; i++)
      f.policy({ toolName: 'generate_image', requestContext: f.context, phase: 'execute' });
    expect(f.skills.list).not.toHaveBeenCalled();
    expect(f.skills.get).not.toHaveBeenCalled();
  });

  it('recovers through the real Agent loop without a custom retry loop', async () => {
    const f = fixture(true);
    const directory = await mkdtemp(path.join(tmpdir(), 'mastra-skill-dependency-'));
    await mkdir(path.join(directory, 'skills', 'image-generation'), { recursive: true });
    await writeFile(
      path.join(directory, 'skills', 'image-generation', 'SKILL.md'),
      '---\nname: image-generation\ndescription: Create an image\n---\nCheck the brief before generating.',
    );
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: directory }),
      skills: ['skills'],
      bm25: true,
    });
    await workspace.skills!.listNames!();
    const realpath = vi.spyOn(workspace.filesystem!, 'realpath');
    expect(await workspace.skills!.listNames!()).toEqual(['image-generation']);
    expect(realpath).not.toHaveBeenCalled();
    realpath.mockRestore();
    const skillSearch = new SkillSearchProcessor({ workspace, trackReadiness: true, ttl: 0 });
    const calls = [
      ['search_tools', { query: 'generate_image' }],
      ['load_skill', { skillName: 'image-generation' }],
      ['search_tools', { query: 'generate_image' }],
      ['generate_image', {}],
    ] as const;
    const offered: string[][] = [];
    let step = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async options => {
        offered.push((options.tools ?? []).map(tool => tool.name));
        const call = calls[step++];
        return {
          content: call
            ? [{ type: 'tool-call', toolCallId: `call-${step}`, toolName: call[0], input: JSON.stringify(call[1]) }]
            : [{ type: 'text', text: 'Done' }],
          finishReason: call ? 'tool-calls' : 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      },
    });
    const agent = new Agent({
      id: 'dependency-test',
      name: 'Dependency test',
      instructions: 'Use the requested tool.',
      model,
      toolPolicy: f.policy,
      inputProcessors: [skillSearch, f.toolSearch],
    });
    new Mastra({ agents: { agent }, logger: false });
    try {
      const result = await agent.generate('Generate an image', { requestContext: f.context, maxSteps: 6 });
      expect(result.text).toBe('Done');
      expect(f.execute).toHaveBeenCalledTimes(1);
      expect(offered.slice(0, 3).every(names => !names.includes('generate_image'))).toBe(true);
      expect(offered[3]).toContain('generate_image');
    } finally {
      skillSearch.dispose();
      await workspace.destroy();
      if (
        path.dirname(directory) !== path.resolve(tmpdir()) ||
        !path.basename(directory).startsWith('mastra-skill-dependency-')
      )
        throw new Error('Unexpected fixture directory');
      await rm(directory, { recursive: true });
    }
  });

  it('blocks direct Agent tools even when per-run hooks override configured hooks', async () => {
    const f = fixture();
    const hook = vi.fn();
    const agent = new Agent({
      id: 'direct-test',
      name: 'Direct test',
      instructions: 'Call the tool.',
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          content: [{ type: 'tool-call', toolCallId: 'direct', toolName: 'generate_image', input: '{}' }],
          finishReason: 'tool-calls',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        }),
      }),
      tools: f.tools,
      toolPolicy: createToolSkillPolicy({
        generate_image: ({ phase }) => (phase === 'execute' ? ['image-generation'] : []),
      }),
      hooks: {
        beforeToolCall: () => {
          throw new Error('Must be overridden');
        },
      },
    });
    new Mastra({ agents: { agent }, logger: false });
    const result = await agent.generate('Generate an image', {
      requestContext: f.context,
      maxSteps: 1,
      hooks: { beforeToolCall: hook },
    });
    expect(hook).toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result.toolResults)).toContain('MISSING_REQUIRED_SKILL');
  });

  it('handles a mixed batch without activating protected tools', async () => {
    const f = fixture();
    const tools = await f.step();
    const result = await tools.load_tool.execute({ toolNames: ['generate_image', 'plain_tool', 'unknown'] });
    expect(result).toMatchObject({
      success: false,
      loaded: ['plain_tool'],
      notFound: ['unknown'],
      dependencyErrors: [{ tool: 'generate_image' }],
    });
    expect((await f.step()).plain_tool).toBeDefined();
    expect((await f.step()).generate_image).toBeUndefined();
  });

  it('does not allow callers to mutate readiness or dependency arrays', async () => {
    const f = fixture();
    await f.step();
    const snapshot = getSkillReadiness(f.context)!;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.readySkills)).toBe(true);
    const required = ['image-generation'];
    const policy = createToolSkillPolicy({ generate_image: required });
    required.pop();
    expect(await policy({ toolName: 'generate_image', phase: 'execute' })).toMatchObject({ allowed: false });
  });

  it('rejects dependencies on recovery tools and protected tools with no server executor', async () => {
    expect(() => createToolSkillPolicy({ load_skill: ['image-generation'] })).toThrow('recovery tool');
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    expect(
      await f.policy({ toolName: 'generate_image', phase: 'load', requestContext: f.context, hasExecute: false }),
    ).toMatchObject({ allowed: false, error: { code: 'TOOL_DEPENDENCY_UNENFORCEABLE', retryable: false } });
    expect(await f.policy({ toolName: 'create_artifact', phase: 'active', hasExecute: false })).toMatchObject({
      allowed: false,
      error: { code: 'TOOL_DEPENDENCY_UNENFORCEABLE', retryable: false },
    });
    expect(await f.policy({ toolName: 'plain_tool', phase: 'active', hasExecute: false })).toEqual({ allowed: true });
  });

  it('does not stack execution guards over a long conversation', async () => {
    const f = fixture();
    const policy = vi.fn(() => ({ allowed: true as const }));
    const search = new ToolSearchProcessor({ tools: {}, toolPolicy: policy, ttl: 0 });
    let tools = f.tools;
    for (let index = 0; index < 100; index++) {
      tools = (await search.processInputStep({ ...f.args, tools })).tools as typeof tools;
    }
    policy.mockClear();
    await tools.plain_tool!.execute!({}, undefined);
    expect(policy).toHaveBeenCalledTimes(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  it('invalidates readiness when another processor removes the skill instructions', async () => {
    const f = fixture();
    await f.step();
    await f.loadSkill('image-generation');
    await f.step();
    expect(getSkillReadiness(f.context)?.readySkills).toEqual(['image-generation']);
    f.args.messageList.clearSystemMessages('skill-search:loaded');
    expect(getSkillReadiness(f.context)).toBeUndefined();
    expect(await f.policy({ toolName: 'generate_image', phase: 'execute', requestContext: f.context })).toMatchObject({
      allowed: false,
    });
  });

  it('blocks restored tool state until the current request loads its skills', async () => {
    const f = fixture(true);
    await f.step();
    await f.loadSkill('image-generation');
    await (await f.step()).search_tools.execute({ query: 'generate_image' });
    expect(
      (await f.toolSearch.getLoadedToolsForRequestContext({ requestContext: f.context })).generate_image,
    ).toBeDefined();
    const resumed = new RequestContext();
    resumed.set(MASTRA_THREAD_ID_KEY, 'thread');
    expect(
      (await f.toolSearch.getLoadedToolsForRequestContext({ requestContext: resumed })).generate_image,
    ).toBeUndefined();
  });

  it('blocks expired skill state without waiting for periodic cleanup', async () => {
    const f = fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const processor = new SkillSearchProcessor({
      workspace: { skills: f.skills } as any,
      trackReadiness: true,
      ttl: 10,
    });
    try {
      const result = await processor.processInputStep(f.args);
      await (result.tools as any).load_skill.execute({ skillName: 'image-generation' });
      await processor.processInputStep(f.args);
      expect(getSkillReadiness(f.context)?.readySkills).toContain('image-generation');
      clock.mockReturnValue(now + 11);
      expect(getSkillReadiness(f.context)).toBeUndefined();
    } finally {
      processor.dispose();
      clock.mockRestore();
    }
  });
});
