import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MASTRA_VERSIONS_KEY } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';

import { MastraEditor } from './index';

function makeMockModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
  });
}

function makeSupervisorModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-sub-agent',
              toolName: 'agent-sub-agent',
              input: JSON.stringify({ prompt: 'Handle this' }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
  });
}

async function createStoredSupervisorRuntime() {
  const storage = new InMemoryStore();
  const editor = new MastraEditor();
  const subModel = makeMockModel('Code sub response');
  const sub = new Agent({
    id: 'sub-agent',
    name: 'Sub Agent',
    instructions: 'Code sub instructions.',
    model: subModel,
  });
  const supervisor = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Code supervisor instructions.',
    model: makeSupervisorModel(),
    agents: { 'sub-agent': sub },
  });
  const mastra = new Mastra({ storage, editor, agents: { supervisor, sub } });
  const agentsStore = await storage.getStore('agents');
  if (!agentsStore?.versionLabels) throw new Error('InMemory agent version labels are unavailable');

  await agentsStore.create({
    agent: {
      id: 'supervisor',
      name: 'Stored Supervisor',
      instructions: 'Stored supervisor instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    },
  });
  const supervisorVersion = await agentsStore.getLatestVersion('supervisor');
  if (!supervisorVersion) throw new Error('Supervisor version was not created');
  await agentsStore.versionLabels.set({
    entityType: 'agent',
    entityId: 'supervisor',
    label: 'root-staging',
    versionId: supervisorVersion.id,
    expectedRevisionToken: null,
  });

  await agentsStore.create({
    agent: {
      id: 'sub-agent',
      name: 'Stored Sub Agent',
      instructions: 'Stored sub instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    },
  });
  const subVersion = await agentsStore.getLatestVersion('sub-agent');
  if (!subVersion) throw new Error('Sub-agent version was not created');
  await agentsStore.versionLabels.set({
    entityType: 'agent',
    entityId: 'sub-agent',
    label: 'sub-staging',
    versionId: subVersion.id,
    expectedRevisionToken: null,
  });

  return { mastra, supervisor, sub, subModel };
}

async function seedVersionedAgent(options: { codeAgent?: Agent } = {}) {
  const storage = new InMemoryStore();
  const editor = new MastraEditor();
  new Mastra({
    storage,
    editor,
    ...(options.codeAgent ? { agents: { 'labelled-agent': options.codeAgent } } : {}),
  });

  const agentsStore = await storage.getStore('agents');
  if (!agentsStore?.versionLabels) throw new Error('InMemory agent version labels are unavailable');

  await agentsStore.create({
    agent: {
      id: 'labelled-agent',
      name: 'Labelled Agent',
      instructions: 'Version one instructions.',
      model: { provider: 'openai', name: 'gpt-4o' },
    },
  });
  const versionOne = await agentsStore.getLatestVersion('labelled-agent');
  if (!versionOne) throw new Error('Version one was not created');

  const versionTwo = await agentsStore.createVersion({
    id: 'labelled-agent-v2',
    agentId: 'labelled-agent',
    versionNumber: 2,
    name: 'Labelled Agent',
    instructions: 'Version two instructions.',
    model: { provider: 'openai', name: 'gpt-4o' },
    changedFields: ['instructions'],
    changeMessage: 'Create version two',
  });

  const pointer = await agentsStore.versionLabels.set({
    entityType: 'agent',
    entityId: 'labelled-agent',
    label: 'staging',
    versionId: versionOne.id,
    expectedRevisionToken: null,
  });

  return { editor, agentsStore, versionOne, versionTwo, pointer };
}

describe('EditorAgentNamespace version label resolution', () => {
  it('keeps a real root label scoped to the supervisor while honoring an explicit stored sub-agent label', async () => {
    const rootOnly = await createStoredSupervisorRuntime();
    const rootOnlyResolve = vi.spyOn(rootOnly.mastra, 'resolveVersionedAgent');
    const codeSubGenerate = vi.spyOn(rootOnly.sub, 'generate');

    await rootOnly.supervisor.generate('Delegate', {
      maxSteps: 3,
      versions: { self: { label: 'root-staging' } },
    });

    const delegatedOptions = codeSubGenerate.mock.calls[0]?.[1];
    expect(delegatedOptions?.versions).toBeUndefined();
    const delegatedVersionContext = delegatedOptions?.requestContext?.get(MASTRA_VERSIONS_KEY);
    expect(delegatedVersionContext).toEqual({ defaultStatus: 'published' });
    expect(delegatedVersionContext).not.toHaveProperty('self');
    expect(delegatedVersionContext).not.toHaveProperty('agents.supervisor');
    expect(rootOnlyResolve.mock.calls.map(([agent, selector]) => [agent.id, selector])).toEqual([
      ['supervisor', { label: 'root-staging' }],
      ['sub-agent', { status: 'published' }],
    ]);
    expect(codeSubGenerate).toHaveBeenCalled();
    expect(rootOnly.subModel.doGenerateCalls[0]?.prompt[0]).toMatchObject({
      role: 'system',
      content: 'Code sub instructions.',
    });

    const explicitSub = await createStoredSupervisorRuntime();
    const explicitResolve = vi.spyOn(explicitSub.mastra, 'resolveVersionedAgent');

    await explicitSub.supervisor.generate('Delegate', {
      maxSteps: 3,
      versions: {
        self: { label: 'root-staging' },
        agents: { 'sub-agent': { label: 'sub-staging' } },
      },
    });

    expect(explicitResolve).toHaveBeenCalledWith(explicitSub.supervisor, { label: 'root-staging' });
    expect(explicitResolve).toHaveBeenCalledWith(explicitSub.sub, { label: 'sub-staging' });
    expect(explicitResolve).not.toHaveBeenCalledWith(explicitSub.sub, { label: 'root-staging' });
    expect(explicitSub.subModel.doGenerateCalls[0]?.prompt[0]).toMatchObject({
      role: 'system',
      content: 'Stored sub instructions.',
    });
  });

  it('re-resolves labelled getById requests after the pointer moves and preserves resolution metadata', async () => {
    const { editor, agentsStore, versionOne, versionTwo, pointer } = await seedVersionedAgent();
    const getByIdResolved = vi.spyOn(agentsStore, 'getByIdResolved');

    const first = await editor.agent.getById('labelled-agent', { label: 'staging' });

    expect(await first?.getInstructions()).toBe('Version one instructions.');
    expect(first?.toRawConfig()).toMatchObject({
      resolvedVersionId: versionOne.id,
      selectedVersionLabel: 'staging',
    });

    await agentsStore.versionLabels!.set({
      entityType: 'agent',
      entityId: 'labelled-agent',
      label: 'staging',
      versionId: versionTwo.id,
      expectedRevisionToken: pointer.revisionToken,
    });

    const second = await editor.agent.getById('labelled-agent', { label: 'staging' });

    expect(await second?.getInstructions()).toBe('Version two instructions.');
    expect(second?.toRawConfig()).toMatchObject({
      resolvedVersionId: versionTwo.id,
      selectedVersionLabel: 'staging',
    });
    expect(getByIdResolved).toHaveBeenNthCalledWith(1, 'labelled-agent', { label: 'staging' });
    expect(getByIdResolved).toHaveBeenNthCalledWith(2, 'labelled-agent', { label: 'staging' });
  });

  it('re-resolves labelled code-agent overrides after the pointer moves and preserves resolution metadata', async () => {
    const codeAgent = new Agent({
      id: 'labelled-agent',
      name: 'Code Agent',
      instructions: 'Code instructions.',
      model: 'openai/gpt-4o',
    });
    const { editor, agentsStore, versionOne, versionTwo, pointer } = await seedVersionedAgent({ codeAgent });
    const getByIdResolved = vi.spyOn(agentsStore, 'getByIdResolved');

    const first = await editor.agent.applyStoredOverrides(codeAgent, { label: 'staging' });

    expect(await first.getInstructions()).toBe('Version one instructions.');
    expect(first.toRawConfig()).toMatchObject({
      resolvedVersionId: versionOne.id,
      selectedVersionLabel: 'staging',
    });

    await agentsStore.versionLabels!.set({
      entityType: 'agent',
      entityId: 'labelled-agent',
      label: 'staging',
      versionId: versionTwo.id,
      expectedRevisionToken: pointer.revisionToken,
    });

    const second = await editor.agent.applyStoredOverrides(codeAgent, { label: 'staging' });

    expect(await second.getInstructions()).toBe('Version two instructions.');
    expect(second.toRawConfig()).toMatchObject({
      resolvedVersionId: versionTwo.id,
      selectedVersionLabel: 'staging',
    });
    expect(getByIdResolved).toHaveBeenNthCalledWith(1, 'labelled-agent', { label: 'staging' });
    expect(getByIdResolved).toHaveBeenNthCalledWith(2, 'labelled-agent', { label: 'staging' });
  });

  it('fails closed when a requested label does not exist', async () => {
    const codeAgent = new Agent({
      id: 'labelled-agent',
      name: 'Code Agent',
      instructions: 'Code instructions.',
      model: 'openai/gpt-4o',
    });
    const { editor } = await seedVersionedAgent({ codeAgent });

    await expect(editor.agent.getById('labelled-agent', { label: 'missing' })).rejects.toMatchObject({
      id: 'VERSION_LABEL_NOT_FOUND',
    });
    await expect(editor.agent.applyStoredOverrides(codeAgent, { label: 'missing' })).rejects.toMatchObject({
      id: 'VERSION_LABEL_NOT_FOUND',
    });
  });

  it('does not let an invalid empty label fall through to a cached default agent', async () => {
    const { editor } = await seedVersionedAgent();
    const cachedDefault = await editor.agent.getById('labelled-agent');
    expect(cachedDefault).not.toBeNull();

    await expect(editor.agent.getById('labelled-agent', { label: '' })).rejects.toMatchObject({
      id: 'INVALID_VERSION_LABEL',
    });
  });

  it('routes exact version IDs through strict storage resolution even when the ID is empty', async () => {
    const { editor } = await seedVersionedAgent();
    const cachedDefault = await editor.agent.getById('labelled-agent');
    expect(cachedDefault).not.toBeNull();

    await expect(editor.agent.getById('labelled-agent', { versionId: '' })).rejects.toMatchObject({
      id: 'VERSION_NOT_FOUND',
    });
  });
});
