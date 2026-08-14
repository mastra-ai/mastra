import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';

import { MastraEditor } from '../index';

async function createEditorWithStore(agents?: Record<string, Agent>) {
  const storage = new InMemoryStore();
  const editor = new MastraEditor();
  new Mastra({ storage, editor, agents });
  const agentsStore = await storage.getStore('agents');
  if (!agentsStore) throw new Error('Agents storage domain is not available');
  const workspaceStore = await storage.getStore('workspaces');
  if (!workspaceStore) throw new Error('Workspaces storage domain is not available');
  return { editor, agentsStore, workspaceStore };
}

describe('EditorAgentNamespace.update', () => {
  it('creates a new draft version when SDK updates agent snapshot fields', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'sdk-updatable-agent',
      name: 'SDK Updatable Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: {},
    });
    const initialRecord = await agentsStore.getById('sdk-updatable-agent');

    const updated = await editor.agent.update({
      id: 'sdk-updatable-agent',
      instructions: 'TWO',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      tools: { lookup: { description: 'Lookup things' } },
    });

    expect(await Promise.resolve(updated.getInstructions())).toBe('TWO');

    const latest = await editor.agent.getById('sdk-updatable-agent', { status: 'draft' });
    expect(await Promise.resolve(latest?.getInstructions())).toBe('TWO');

    const versionTwoAgent = await editor.agent.getById('sdk-updatable-agent', { versionNumber: 2 });
    expect(await Promise.resolve(versionTwoAgent?.getInstructions())).toBe('TWO');

    const versions = await agentsStore.listVersions({ agentId: 'sdk-updatable-agent' });
    expect(versions.versions).toHaveLength(2);

    const versionTwo = versions.versions.find(version => version.versionNumber === 2);
    expect(versionTwo?.changedFields).toEqual(['instructions', 'model', 'tools']);

    const record = await agentsStore.getById('sdk-updatable-agent');
    expect(record?.activeVersionId).toBe(initialRecord?.activeVersionId);
    expect(record?.activeVersionId).not.toBe(versionTwo?.id);
  });

  it('keeps SDK config updates in draft until they are published', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'published-sdk-agent',
      name: 'Published SDK Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
    });
    const initialVersions = await agentsStore.listVersions({ agentId: 'published-sdk-agent' });
    const versionOne = initialVersions.versions.find(version => version.versionNumber === 1);
    await agentsStore.update({ id: 'published-sdk-agent', activeVersionId: versionOne!.id, status: 'published' });

    await editor.agent.update({
      id: 'published-sdk-agent',
      instructions: 'TWO',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    editor.agent.clearCache('published-sdk-agent');
    const defaultAgent = await editor.agent.getById('published-sdk-agent');
    expect(await Promise.resolve(defaultAgent?.getInstructions())).toBe('ONE');
    const draftAgent = await editor.agent.getById('published-sdk-agent', { status: 'draft' });
    expect(await Promise.resolve(draftAgent?.getInstructions())).toBe('TWO');

    const versions = await agentsStore.listVersions({ agentId: 'published-sdk-agent' });
    const versionTwo = versions.versions.find(version => version.versionNumber === 2);
    const record = await agentsStore.getById('published-sdk-agent');
    expect(record?.activeVersionId).toBe(versionOne?.id);
    expect(record?.activeVersionId).not.toBe(versionTwo?.id);
  });

  it('preserves an explicit activeVersionId while creating a new snapshot version', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'explicit-active-version-agent',
      name: 'Explicit Active Version Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
    });
    const initialVersions = await agentsStore.listVersions({ agentId: 'explicit-active-version-agent' });
    const versionOne = initialVersions.versions.find(version => version.versionNumber === 1);

    await editor.agent.update({
      id: 'explicit-active-version-agent',
      activeVersionId: versionOne!.id,
      instructions: 'TWO',
    });

    const versions = await agentsStore.listVersions({ agentId: 'explicit-active-version-agent' });
    const versionTwo = versions.versions.find(version => version.versionNumber === 2);
    const record = await agentsStore.getById('explicit-active-version-agent');
    expect(record?.activeVersionId).toBe(versionOne?.id);
    expect(record?.activeVersionId).not.toBe(versionTwo?.id);
  });

  it('updates record fields without creating a new version', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'record-only-agent',
      name: 'Record Only Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
      metadata: { team: 'alpha' },
    });

    const updated = await editor.agent.update({
      id: 'record-only-agent',
      metadata: { environment: 'test' },
      status: 'archived',
    });

    const rawConfig = updated.toRawConfig();
    expect(rawConfig?.metadata).toEqual({ team: 'alpha', environment: 'test' });
    expect(rawConfig?.status).toBe('archived');

    const versions = await agentsStore.listVersions({ agentId: 'record-only-agent' });
    expect(versions.versions).toHaveLength(1);
  });

  it('does not create a new version when provided snapshot fields are unchanged', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'unchanged-config-agent',
      name: 'Unchanged Config Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    await editor.agent.update({
      id: 'unchanged-config-agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const versions = await agentsStore.listVersions({ agentId: 'unchanged-config-agent' });
    expect(versions.versions).toHaveLength(1);
  });

  it('creates a version when SDK updates skillsFormat', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'skills-format-agent',
      name: 'Skills Format Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
      skillsFormat: 'xml',
    });

    const updated = await editor.agent.update({
      id: 'skills-format-agent',
      skillsFormat: 'markdown',
    });

    expect(updated.toRawConfig()?.skillsFormat).toBe('markdown');

    const versions = await agentsStore.listVersions({ agentId: 'skills-format-agent' });
    expect(versions.versions).toHaveLength(2);
    const versionTwo = versions.versions.find(version => version.versionNumber === 2);
    expect(versionTwo?.changedFields).toEqual(['skillsFormat']);
    expect(versionTwo?.skillsFormat).toBe('markdown');
  });

  it('persists inline workspaces before creating a version from an SDK update', async () => {
    const { editor, workspaceStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'workspace-update-agent',
      name: 'Workspace Update Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
    });

    const workspace = {
      type: 'inline' as const,
      config: {
        name: 'Updated Workspace',
        description: 'Persisted from update',
        skills: ['skill-1'],
      },
    };

    await editor.agent.update({
      id: 'workspace-update-agent',
      workspace,
    });

    const workspaceId = `inline-${createHash('sha256')
      .update(JSON.stringify(workspace.config))
      .digest('hex')
      .slice(0, 12)}`;
    const storedWorkspace = await workspaceStore.getByIdResolved(workspaceId);
    expect(storedWorkspace?.name).toBe('Updated Workspace');
  });

  it('returns a merged code-defined agent when SDK updates a partial stored override', async () => {
    const codeAgent = new Agent({
      id: 'code-defined-update-agent',
      name: 'Code Defined Update Agent',
      instructions: 'Code instructions',
      model: 'openai/gpt-4o',
    });
    const { editor } = await createEditorWithStore({ codeAgent });

    await editor.agent.create({
      id: 'code-defined-update-agent',
      instructions: 'Stored ONE',
    } as any);

    const updated = await editor.agent.update({
      id: 'code-defined-update-agent',
      instructions: 'Stored TWO',
    });

    expect(await updated.getInstructions()).toBe('Stored TWO');
    expect(updated.model).toBe('openai/gpt-4o');

    const fetched = await editor.agent.getById('code-defined-update-agent');
    expect(await fetched?.getInstructions()).toBe('Stored TWO');
  });
});
