import { beforeEach, describe, it, expect, vi } from 'vitest';

/**
 * The factory *list* persists in localStorage so reopening the web app still
 * knows about bound factories. The *active* factory is intentionally not
 * persisted anymore — it resolves from the `/factories/:factoryId` URL param.
 *
 * factories.ts is localStorage-driven and the scenario env is node, so we stub a
 * minimal localStorage before importing the module.
 */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

const factoryA = {
  id: 'factory-1',
  name: 'A',
  resourceId: 'mastra-aaa',
  createdAt: 1,
  binding: { kind: 'local' as const, path: '/a' },
};

const factoryB = {
  id: 'factory-2',
  name: 'B',
  resourceId: 'mastra-bbb',
  createdAt: 2,
  binding: { kind: 'local' as const, path: '/b' },
};

describe('factory list persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
  });

  it('persists and restores the factory list', async () => {
    const { saveFactories, loadFactories } = await import('../../src/web/ui/domains/workspaces/services/factories.js');
    expect(loadFactories()).toEqual([]);
    saveFactories([factoryA, factoryB]);
    expect(loadFactories()).toEqual([factoryA, factoryB]);
  });

  it('removes only the requested factory from the list', async () => {
    const { saveFactories, loadFactories, removeFactory } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA, factoryB]);
    await removeFactory('', 'factory-1');
    expect(loadFactories()).toEqual([factoryB]);
  });

  it('does not persist an active factory id', async () => {
    const { saveFactories } = await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA]);
    expect(localStorage.getItem('mastracode-active-factory')).toBeNull();
  });

  it('stores only the new factory key and rejects flat legacy records', async () => {
    const { loadFactories, saveFactories } = await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA]);
    expect(localStorage.getItem('mastracode-factories')).toContain('factory-1');
    expect(localStorage.getItem('mastracode-projects')).toBeNull();

    localStorage.setItem(
      'mastracode-factories',
      JSON.stringify([{ id: 'flat', name: 'Flat', path: '/flat', source: 'local', createdAt: 1 }]),
    );
    expect(loadFactories()).toEqual([]);
  });
});
