import { describe, expect, it, vi } from 'vitest';

import { CrudEditorNamespace } from './base';
import type { GetByIdOptions, StorageAdapter } from './base';

type Entity = { id: string; versionNumber: number };
type Input = { id: string };

function createNamespace() {
  const latest: Entity = { id: 'cached', versionNumber: 3 };
  const getByIdResolved = vi.fn(async (id: string, options?: GetByIdOptions): Promise<Entity | null> => {
    if (options?.versionNumber === 0) return null;
    if (options?.versionNumber !== undefined) return { id, versionNumber: options.versionNumber };
    return latest;
  });
  const adapter: StorageAdapter<Input, Input, void, Entity[], Entity[], Entity> = {
    create: vi.fn(async () => undefined),
    getByIdResolved,
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    listResolved: vi.fn(async () => []),
  };

  class TestNamespace extends CrudEditorNamespace<Input, Input, void, Entity[], Entity[], Entity> {
    protected async getStorageAdapter() {
      return adapter;
    }
  }

  return {
    namespace: new TestNamespace({ __mastra: {} } as never),
    getByIdResolved,
  };
}

describe('CrudEditorNamespace', () => {
  it('bypasses the default cache whenever versionNumber is provided', async () => {
    const { namespace, getByIdResolved } = createNamespace();

    await namespace.create({ id: 'cached' });
    getByIdResolved.mockClear();

    await expect(namespace.getById('cached', { versionNumber: 0 })).resolves.toBeNull();
    expect(getByIdResolved).toHaveBeenCalledWith('cached', { versionNumber: 0 });

    await expect(namespace.getById('cached', { versionNumber: 2 })).resolves.toEqual({
      id: 'cached',
      versionNumber: 2,
    });
    expect(getByIdResolved).toHaveBeenCalledWith('cached', { versionNumber: 2 });
  });
});
