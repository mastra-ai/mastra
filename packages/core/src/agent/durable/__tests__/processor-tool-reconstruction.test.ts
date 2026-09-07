import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { SkillSearchProcessor, ToolSearchProcessor } from '../../../processors';
import type { ProcessInputStepArgs } from '../../../processors';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { noopObserve } from '../../../tools/types';
import { LocalFilesystem, Workspace } from '../../../workspace';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { createDurableAgent } from '../create-durable-agent';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function context(tenant = 'a') {
  const result = new RequestContext();
  result.set('tenant', tenant);
  result.set(MASTRA_THREAD_ID_KEY, `thread-${tenant}`);
  return result;
}

function step(requestContext: RequestContext, tools: Record<string, unknown>): ProcessInputStepArgs {
  const model = new MockLanguageModelV2();
  return {
    tools,
    requestContext,
    messageList: new MessageList({}),
    messages: [],
    systemMessages: [],
    state: {},
    stepNumber: 1,
    steps: [],
    retryCount: 0,
    model: { ...model, supportedUrls: model.supportedUrls, doGenerate: model.doStream, doStream: model.doStream },
    abort: () => {
      throw new Error('Unexpected processor abort');
    },
  };
}

function fixtureTool(id: string) {
  return createTool({ id, description: `Find ${id} invoices`, inputSchema: z.object({}), execute: async () => id });
}

async function workspace() {
  const prefix = path.join(os.tmpdir(), 'mastra-processor-reconstruction-');
  const root = await mkdtemp(prefix);
  cleanups.push(async () => {
    if (!path.resolve(root).startsWith(path.resolve(prefix))) throw new Error('Unexpected fixture path');
    await rm(root, { recursive: true, force: true });
  });
  for (const tenant of ['a', 'b']) {
    const dir = path.join(root, 'skills', tenant, `fixture-${tenant}`);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'SKILL.md'),
      `---\nname: fixture-${tenant}\ndescription: Invoice fixture for tenant ${tenant}\n---\nUse invoice handling instructions for tenant ${tenant}.\n`,
    );
  }
  const result = new Workspace({
    filesystem: new LocalFilesystem({ basePath: root }),
    skills: ({ requestContext }) => [`skills/${requestContext?.get('tenant') ?? 'a'}`],
    bm25: true,
  });
  await result.init();
  cleanups.push(() => result.destroy());
  return result;
}

describe('processor tools reconstructed before a saved approval executes', () => {
  it.each([false, true])(
    'assembles both native processor tool sets without replaying a step (autoLoad=%s)',
    async autoLoad => {
      const skills = new SkillSearchProcessor({ workspace: await workspace(), ttl: 0 });
      const search = new ToolSearchProcessor({
        tools: { invoice: fixtureTool('invoice') },
        search: { autoLoad },
        storage: 'context',
        ttl: 0,
      });
      cleanups.push(
        () => skills.dispose(),
        () => search.clearAllState(),
      );
      const base = new Agent({
        id: 'reconstruction',
        name: 'Reconstruction',
        instructions: 'Use the fixture.',
        model: new MockLanguageModelV2(),
        inputProcessors: async () => [search, skills],
      });
      const agent = createDurableAgent({ agent: base });
      const mastra = new Mastra({ storage: new InMemoryStore(), agents: { agent }, logger: false });
      cleanups.push(() => mastra.shutdown());
      expect(mastra.getAgentById(agent.id)).toBe(agent);
      const tools = await agent.getToolsForExecution({ runId: 'saved-approval', requestContext: context() });
      expect(Object.keys(tools)).toEqual(expect.arrayContaining(['search_tools', 'search_skills', 'load_skill']));
      expect('load_tool' in tools).toBe(!autoLoad);
      expect('invoice' in tools).toBe(false);
      expect('unknown_tool' in tools).toBe(false);
      expect(
        await tools.search_skills!.execute!({ query: 'invoice' }, { toolCallId: 'search', messages: [] }),
      ).toMatchObject({ results: [{ name: 'fixture-a' }] });
      expect(
        await tools.load_skill!.execute!({ skillName: 'fixture-a' }, { toolCallId: 'load', messages: [] }),
      ).toMatchObject({ success: true, skillName: 'fixture-a' });
    },
  );

  it('rebuilds skills using the current tenant and native thread scope', async () => {
    const skills = new SkillSearchProcessor({ workspace: await workspace(), ttl: 0 });
    cleanups.push(() => skills.dispose());
    const agent = new Agent({
      id: 'scoped-reconstruction',
      name: 'Scoped reconstruction',
      instructions: 'Use the fixture.',
      model: new MockLanguageModelV2(),
      inputProcessors: [skills],
    });
    const a = await agent.getToolsForExecution({ requestContext: context('a') });
    expect(a.load_skill).toBeDefined();
    await a.load_skill!.execute!({ skillName: 'fixture-a' }, { toolCallId: 'a', messages: [] });
    const b = await agent.getToolsForExecution({ requestContext: context('b') });
    expect(await b.load_skill!.execute!({ skillName: 'fixture-a' }, { toolCallId: 'b', messages: [] })).toMatchObject({
      success: false,
    });
    expect(
      await b.load_skill!.execute!({ skillName: 'fixture-b' }, { toolCallId: 'b-own', messages: [] }),
    ).toMatchObject({ success: true });
    const aStep = await skills.processInputStep(step(context('a'), a));
    expect(aStep.tools).toHaveProperty('load_skill');
  });

  it('uses the current step catalog and filter instead of an earlier reconstructed meta-tool closure', async () => {
    const search = new ToolSearchProcessor({
      tools: {},
      includeResolvedTools: true,
      storage: 'context',
      ttl: 0,
      filter: ({ requestContext }) => requestContext?.get('tenant') === 'b',
    });
    cleanups.push(() => search.clearAllState());
    const oldTools = { old_invoice: fixtureTool('old_invoice') };
    expect(await search.getLoadedToolsForRequestContext({ requestContext: context('a'), tools: oldTools })).toEqual({});
    const agent = new Agent({
      id: 'current-step',
      name: 'Current step',
      instructions: 'Use the fixture.',
      model: new MockLanguageModelV2(),
      tools: oldTools,
      inputProcessors: [search],
    });
    const rebuilt = await agent.getToolsForExecution({ requestContext: context('a') });
    expect(rebuilt.search_tools).toBeDefined();
    const fresh = await search.processInputStep(
      step(context('b'), {
        search_tools: rebuilt.search_tools,
        load_tool: rebuilt.load_tool,
        new_invoice: fixtureTool('new_invoice'),
      }),
    );
    const result = await fresh.tools.search_tools.execute!(
      { query: 'invoice' },
      { requestContext: context('b'), observe: noopObserve },
    );
    expect(result).toMatchObject({ results: [{ name: 'new_invoice' }] });
    expect(Object.keys(fresh.tools).slice(0, 2)).toEqual(['search_tools', 'load_tool']);
    expect('new_invoice' in fresh.tools).toBe(false);
    expect(JSON.stringify(fresh.tools)).not.toContain('processorToolOwner');
    expect(
      await fresh.tools.search_tools.execute!(
        { query: 'search_tools load_tool' },
        { requestContext: context('b'), observe: noopObserve },
      ),
    ).toMatchObject({ results: [] });
  });

  it('preserves explicit user overrides of tool search meta-tool names', async () => {
    const search = new ToolSearchProcessor({ tools: {}, ttl: 0 });
    const overrides = { search_tools: fixtureTool('search_tools'), load_tool: fixtureTool('load_tool') };
    const agent = new Agent({
      id: 'overrides',
      name: 'Overrides',
      instructions: 'Use the fixture.',
      model: new MockLanguageModelV2(),
      tools: overrides,
      inputProcessors: [search],
    });
    const assembled = await agent.getToolsForExecution({ requestContext: context() });
    const result = await search.processInputStep(step(context(), assembled));
    expect(result.tools.search_tools).toBe(assembled.search_tools);
    expect(result.tools.load_tool).toBe(assembled.load_tool);
    expect(await assembled.search_tools!.execute!({}, { toolCallId: 'user-search', messages: [] })).toBe(
      'search_tools',
    );
    expect(await assembled.load_tool!.execute!({}, { toolCallId: 'user-load', messages: [] })).toBe('load_tool');
  });

  it('warns for actual skill name collisions but not its own converted tools', async () => {
    const skills = new SkillSearchProcessor({ workspace: await workspace(), ttl: 0 });
    cleanups.push(() => skills.dispose());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => {
      warn.mockRestore();
    });
    const agent = new Agent({
      id: 'skill-warning',
      name: 'Skill warning',
      instructions: 'Use the fixture.',
      model: new MockLanguageModelV2(),
      inputProcessors: [skills],
    });
    const assembled = await agent.getToolsForExecution({ requestContext: context() });
    await skills.processInputStep(step(context(), assembled));
    expect(warn).not.toHaveBeenCalled();
    await skills.processInputStep(step(context(), { load_skill: fixtureTool('load_skill') }));
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[SkillSearchProcessor] User tool "load_skill" conflicts with meta-tool and will be shadowed.',
    );
  });

  it('does not expose processor tools when the processors are disabled', async () => {
    const agent = new Agent({
      id: 'plain',
      name: 'Plain',
      instructions: 'Use the fixture.',
      model: new MockLanguageModelV2(),
      tools: { invoice: fixtureTool('invoice') },
    });
    expect(Object.keys(await agent.getToolsForExecution({ requestContext: context() }))).toEqual(['invoice']);
  });
});
