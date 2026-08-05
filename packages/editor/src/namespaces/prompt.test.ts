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
});
