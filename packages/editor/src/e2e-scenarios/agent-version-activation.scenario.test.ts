import { describe, expect, it } from 'vitest';
import { createEditorScenarioMastra } from './editor-scenario-utils';

describe('Editor E2E scenario: stored agent version activation', () => {
  it('changes the effective runtime instructions after a version is activated and the editor cache is invalidated', async () => {
    // USER STORY: A Studio user publishes a saved agent version and subsequent runs use that version.
    // ARRANGE: Create a stored agent and warm the runtime cache with its original instructions.
    const { storage, editor } = createEditorScenarioMastra();
    const agentsStore = await storage.getStore('agents');

    const created = await editor.agent.create({
      id: 'versioned-agent',
      name: 'Versioned Agent',
      instructions: 'Draft v1 instructions.',
      model: { provider: 'mock', name: 'editor-scenario' },
    });
    const firstRun = await created.generate('Which version is active?');

    // ACT: Persist a second version, mark it active like the server activation route, and clear Editor cache.
    const version = await agentsStore?.createVersion({
      agentId: 'versioned-agent',
      versionNumber: 2,
      name: 'Versioned Agent',
      instructions: 'Published v2 instructions.',
      model: { provider: 'mock', name: 'editor-scenario' },
      status: 'published',
      changeMessage: 'Publish v2',
    });
    await agentsStore?.update({ id: 'versioned-agent', activeVersionId: version?.id, status: 'published' });
    editor.agent.clearCache('versioned-agent');
    const activated = await editor.agent.getById('versioned-agent');
    const secondRun = await activated!.generate('Which version is active now?');

    // ASSERT: Runtime behavior changes from v1 to v2 after activation.
    expect(firstRun.text).toContain('Draft v1 instructions.');
    expect(secondRun.text).toContain('Published v2 instructions.');
  });
});
