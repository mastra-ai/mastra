import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';

import { MastraEditor } from '../index';

async function createEditorWithStore(agents?: Record<string, Agent>) {
  const storage = new InMemoryStore();
  const editor = new MastraEditor();
  const mastra = new Mastra({ storage, editor, agents });
  const agentsStore = await storage.getStore('agents');
  if (!agentsStore) throw new Error('Agents storage domain is not available');
  const workspaceStore = await storage.getStore('workspaces');
  if (!workspaceStore) throw new Error('Workspaces storage domain is not available');
  return { editor, mastra, agentsStore, workspaceStore };
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

  it('persists durable on the version snapshot and hydrates a durable agent', async () => {
    const { editor, mastra, agentsStore } = await createEditorWithStore();

    const created = await editor.agent.create({
      id: 'durable-agent',
      name: 'Durable Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
      durable: true,
    });

    expect(created.toRawConfig()?.durable).toBe(true);
    // `Mastra.addAgent` wraps agents whose `durable` is truthy; the wrapper
    // points at the underlying agent instead of itself.
    const registered = mastra.getAgentById('durable-agent') as unknown as { agent?: unknown };
    expect(registered).toBeDefined();
    expect(registered.agent).not.toBe(registered);

    const versionOne = (await agentsStore.listVersions({ agentId: 'durable-agent' })).versions.find(
      version => version.versionNumber === 1,
    );
    expect(versionOne?.durable).toBe(true);
  });

  it('creates a version when SDK updates durable', async () => {
    const { editor, agentsStore } = await createEditorWithStore();

    await editor.agent.create({
      id: 'durable-update-agent',
      name: 'Durable Update Agent',
      instructions: 'ONE',
      model: { provider: 'openai', name: 'gpt-4' },
      durable: true,
    });

    const updated = await editor.agent.update({
      id: 'durable-update-agent',
      durable: { maxSteps: 10 },
    });

    expect(updated.toRawConfig()?.durable).toEqual({ maxSteps: 10 });

    const versions = await agentsStore.listVersions({ agentId: 'durable-update-agent' });
    expect(versions.versions).toHaveLength(2);
    const versionTwo = versions.versions.find(version => version.versionNumber === 2);
    expect(versionTwo?.changedFields).toEqual(['durable']);
    expect(versionTwo?.durable).toEqual({ maxSteps: 10 });
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

// Regression tests for https://github.com/mastra-ai/mastra/issues/21373 —
// an agent with `editor: { instructions: true }` cannot provide code instructions
// (the type system forbids it), so if nothing resolves it must fail closed instead
// of silently generating with empty instructions.
describe('EditorAgentNamespace.applyStoredOverrides fails closed when editor exclusively owns instructions', () => {
  function makeEditorOwnedAgent() {
    return new Agent({
      id: 'editor-owned-agent',
      name: 'Editor Owned Agent',
      editor: { instructions: true, tools: false },
      model: 'openai/gpt-4o',
    });
  }

  it('throws when no stored agent record exists yet', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = makeEditorOwnedAgent();
    new Mastra({ storage, editor, agents: { 'editor-owned-agent': codeAgent } });

    await expect(editor.agent.applyStoredOverrides(codeAgent, { status: 'published' })).rejects.toThrow(
      /delegates instructions to the editor/,
    );
  });

  it('throws when the stored agent is draft-only and status: "published" is requested', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = makeEditorOwnedAgent();
    new Mastra({ storage, editor, agents: { 'editor-owned-agent': codeAgent } });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'editor-owned-agent',
        name: 'Editor Owned Agent',
        instructions: 'DRAFT-ONLY-INSTRUCTIONS',
        model: { provider: 'openai', name: 'gpt-4o' },
      },
      // no activeVersionId set -> draft-only, never published
    } as Record<string, unknown>);

    // Draft status still resolves normally.
    const draftResolved = await editor.agent.applyStoredOverrides(codeAgent, { status: 'draft' });
    expect(await draftResolved.getInstructions()).toBe('DRAFT-ONLY-INSTRUCTIONS');

    // Published status has nothing to resolve — must fail closed.
    await expect(editor.agent.applyStoredOverrides(codeAgent, { status: 'published' })).rejects.toThrow(
      /no version has been published/,
    );
  });

  it('throws when a published record exists but carries no instructions', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = makeEditorOwnedAgent();
    new Mastra({ storage, editor, agents: { 'editor-owned-agent': codeAgent } });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'editor-owned-agent',
        name: 'Editor Owned Agent',
        model: { provider: 'openai', name: 'gpt-4o' },
        // no `instructions` field at all — a published version can still be missing it.
      },
    } as Record<string, unknown>);

    // Publish the version that `create` implicitly wrote (version 1, with no instructions).
    const { versions } = (await agentsStore?.listVersions({ agentId: 'editor-owned-agent' })) ?? { versions: [] };
    await agentsStore?.update({ id: 'editor-owned-agent', activeVersionId: versions[0]?.id });

    await expect(editor.agent.applyStoredOverrides(codeAgent, { status: 'published' })).rejects.toThrow(
      /has no instructions/,
    );
  });

  it('throws when the storage adapter fails to load the stored config', async () => {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = makeEditorOwnedAgent();
    new Mastra({ storage, editor, agents: { 'editor-owned-agent': codeAgent } });

    vi.spyOn(editor.agent as any, 'getStorageAdapter').mockRejectedValue(new Error('storage unavailable'));

    await expect(editor.agent.applyStoredOverrides(codeAgent, { status: 'published' })).rejects.toThrow(
      /delegates instructions to the editor/,
    );
  });

  it('does not throw for a code-owned agent (no editor config) in the same unresolved scenarios', async () => {
    // Sanity check: the fail-closed behavior is scoped to editor-owned instructions only.
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'code-owned-agent',
      name: 'Code Agent',
      instructions: 'You are a code-defined agent.',
      model: 'openai/gpt-4o',
    });
    new Mastra({ storage, editor, agents: { 'code-owned-agent': codeAgent } });

    const result = await editor.agent.applyStoredOverrides(codeAgent, { status: 'published' });
    expect(result).toBe(codeAgent);
  });
});

describe('EditorAgentNamespace.applyStoredOverrides instruction envelope preservation (providerOptions)', () => {
  const CACHE_OPTIONS = { anthropic: { cacheControl: { type: 'ephemeral' } } };

  async function setupWithInstructions(
    codeInstructions: ConstructorParameters<typeof Agent>[0]['instructions'],
    storedInstructions: unknown,
  ) {
    const storage = new InMemoryStore();
    const editor = new MastraEditor();
    const codeAgent = new Agent({
      id: 'cached-agent',
      name: 'Cached Agent',
      instructions: codeInstructions,
      model: 'anthropic/claude-sonnet-4-5',
    });
    new Mastra({ storage, editor, agents: { 'cached-agent': codeAgent } });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'cached-agent',
        name: 'Cached Agent',
        instructions: storedInstructions,
        model: { provider: 'anthropic', name: 'claude-sonnet-4-5' },
      },
    });

    return { editor, codeAgent };
  }

  it('keeps providerOptions from a structured code message when a stored string overrides the text', async () => {
    const { editor, codeAgent } = await setupWithInstructions(
      { role: 'system', content: 'Code wording.', providerOptions: CACHE_OPTIONS },
      'Edited wording from Studio.',
    );

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toEqual({
      role: 'system',
      content: 'Edited wording from Studio.',
      providerOptions: CACHE_OPTIONS,
    });
  });

  it('keeps providerOptions when the stored override uses instruction blocks', async () => {
    const { editor, codeAgent } = await setupWithInstructions(
      { role: 'system', content: 'Code wording.', providerOptions: CACHE_OPTIONS },
      [
        { type: 'text', content: 'Edited block one.' },
        { type: 'text', content: 'Edited block two.' },
      ],
    );

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toEqual({
      role: 'system',
      content: 'Edited block one.\n\nEdited block two.',
      providerOptions: CACHE_OPTIONS,
    });
  });

  it('keeps the last message envelope when code instructions are an array of system messages', async () => {
    const { editor, codeAgent } = await setupWithInstructions(
      [
        { role: 'system', content: 'First code message.' },
        { role: 'system', content: 'Second code message.', providerOptions: CACHE_OPTIONS },
      ],
      'Edited wording from Studio.',
    );

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toEqual({
      role: 'system',
      content: 'Edited wording from Studio.',
      providerOptions: CACHE_OPTIONS,
    });
  });

  it('merges the envelope at request time when code instructions are dynamic', async () => {
    const { editor, codeAgent } = await setupWithInstructions(
      ({ requestContext }) => ({
        role: 'system' as const,
        content: `Code wording for ${requestContext.get('tenant') ?? 'default'}.`,
        providerOptions: CACHE_OPTIONS,
      }),
      'Edited wording from Studio.',
    );

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');
    expect(await result.getInstructions({ requestContext })).toEqual({
      role: 'system',
      content: 'Edited wording from Studio.',
      providerOptions: CACHE_OPTIONS,
    });
  });

  it('falls back to the stored text when dynamic code instructions throw', async () => {
    const { editor, codeAgent } = await setupWithInstructions(() => {
      throw new Error('needs context this request cannot provide');
    }, 'Edited wording from Studio.');

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toBe('Edited wording from Studio.');
  });

  it('leaves plain-string code instructions overridden as a plain string', async () => {
    const { editor, codeAgent } = await setupWithInstructions('Code wording.', 'Edited wording from Studio.');

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toBe('Edited wording from Studio.');
  });

  it('leaves string-array code instructions overridden as a plain string', async () => {
    const { editor, codeAgent } = await setupWithInstructions(
      ['Code wording one.', 'Code wording two.'],
      'Edited wording from Studio.',
    );

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(await result.getInstructions()).toBe('Edited wording from Studio.');
  });

  it('does not mutate the original agent instructions', async () => {
    const codeInstructions = { role: 'system' as const, content: 'Code wording.', providerOptions: CACHE_OPTIONS };
    const { editor, codeAgent } = await setupWithInstructions(codeInstructions, 'Edited wording from Studio.');

    const result = await editor.agent.applyStoredOverrides(codeAgent);

    expect(result).not.toBe(codeAgent);
    expect(await codeAgent.getInstructions()).toEqual({
      role: 'system',
      content: 'Code wording.',
      providerOptions: CACHE_OPTIONS,
    });
  });
});
