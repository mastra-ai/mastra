import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '@mastra/core/storage';

import { EditorPromptNamespace } from './prompt';

function createPromptNamespace(storage: InMemoryStore) {
  return new EditorPromptNamespace({
    __mastra: {
      getStorage: () => storage,
      removePromptBlock: vi.fn(),
    },
    __logger: {
      debug: vi.fn(),
    },
  } as any);
}

describe('EditorPromptNamespace', () => {
  it('updates prompt block snapshot fields through the SDK', async () => {
    const storage = new InMemoryStore();
    const prompt = createPromptNamespace(storage);

    await prompt.create({
      id: 'sdk-updatable-block',
      name: 'SDK Updatable Block',
      content: 'Initial content',
    });
    const promptStore = await storage.getStore('promptBlocks');
    const updateSpy = vi.spyOn(promptStore!, 'update');

    const updated = await prompt.update({
      id: 'sdk-updatable-block',
      name: 'SDK Updated Block',
      content: 'Updated content',
      rules: {
        operator: 'AND',
        conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
      },
      requestContextSchema: {
        type: 'object',
        properties: {
          role: { type: 'string' },
        },
        required: ['role'],
      },
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(updated.name).toBe('SDK Updated Block');
    expect(updated.content).toBe('Updated content');
    expect(updated.rules).toEqual({
      operator: 'AND',
      conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
    });
    expect(updated.requestContextSchema).toEqual({
      type: 'object',
      properties: {
        role: { type: 'string' },
      },
      required: ['role'],
    });

    const persisted = await prompt.getById('sdk-updatable-block');
    expect(persisted!.name).toBe('SDK Updated Block');
    expect(persisted!.content).toBe('Updated content');
    expect(persisted!.rules).toEqual(updated.rules);
    expect(persisted!.requestContextSchema).toEqual(updated.requestContextSchema);

    const versions = await promptStore!.listVersions({ blockId: 'sdk-updatable-block' });
    expect(versions.versions).toHaveLength(2);
    expect(versions.versions[0]!.changedFields).toEqual(['name', 'content', 'rules', 'requestContextSchema']);
    expect(updated.activeVersionId).toBeUndefined();
  });

  it('keeps default reads pinned while exposing draft and specific versions', async () => {
    const storage = new InMemoryStore();
    const prompt = createPromptNamespace(storage);

    await prompt.create({
      id: 'pinned-block',
      name: 'Pinned Block',
      content: 'Published content',
    });
    const promptStore = await storage.getStore('promptBlocks');
    const initialVersions = await promptStore!.listVersions({ blockId: 'pinned-block' });
    const versionOne = initialVersions.versions.find(version => version.versionNumber === 1)!;
    await promptStore!.update({ id: 'pinned-block', activeVersionId: versionOne.id, status: 'published' });

    const updated = await prompt.update({ id: 'pinned-block', content: 'Draft content' });
    expect(updated.content).toBe('Draft content');

    const warmDefault = await prompt.getById('pinned-block');
    const freshPrompt = createPromptNamespace(storage);
    const coldDefault = await freshPrompt.getById('pinned-block');
    expect(warmDefault!.content).toBe('Published content');
    expect(coldDefault!.content).toBe('Published content');

    const draft = await freshPrompt.getById('pinned-block', { status: 'draft' });
    expect(draft!.content).toBe('Draft content');

    const versions = await promptStore!.listVersions({ blockId: 'pinned-block' });
    const versionTwo = versions.versions.find(version => version.versionNumber === 2)!;
    const explicitVersion = await freshPrompt.getById('pinned-block', { versionId: versionTwo.id });
    expect(explicitVersion!.content).toBe('Draft content');
  });
});
