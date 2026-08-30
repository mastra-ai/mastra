import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';

import { MastraEditor } from './index';

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
