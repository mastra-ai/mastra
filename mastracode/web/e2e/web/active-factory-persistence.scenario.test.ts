import { beforeEach, describe, it, expect, vi } from 'vitest';

/**
 * Reopening the web app must restore the previously active factory so its
 * session reconnects and threads reappear — without the user re-selecting it.
 * This guards the regression where activeFactoryId reset to null on reload.
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

describe('active factory persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
  });

  it('persists and restores the active factory id', async () => {
    const { saveActiveFactoryId, loadActiveFactoryId } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    expect(loadActiveFactoryId()).toBeNull();
    saveActiveFactoryId('factory-1');
    expect(loadActiveFactoryId()).toBe('factory-1');
  });

  it('clears the active id when null is saved', async () => {
    const { saveActiveFactoryId, loadActiveFactoryId } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveActiveFactoryId('factory-1');
    saveActiveFactoryId(null);
    expect(loadActiveFactoryId()).toBeNull();
  });

  it('clears the active id when the active factory is removed', async () => {
    const { saveFactories, saveActiveFactoryId, loadActiveFactoryId, removeFactory } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA, factoryB]);
    saveActiveFactoryId('factory-1');
    await removeFactory('', 'factory-1');
    expect(loadActiveFactoryId()).toBeNull();
  });

  it('leaves the active id alone when a different factory is removed', async () => {
    const { saveFactories, saveActiveFactoryId, loadActiveFactoryId, removeFactory } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA, factoryB]);
    saveActiveFactoryId('factory-1');
    await removeFactory('', 'factory-2');
    expect(loadActiveFactoryId()).toBe('factory-1');
  });

  it('stores only the new factory keys and rejects flat legacy records', async () => {
    const { loadFactories, saveFactories, saveActiveFactoryId, loadActiveFactoryId } =
      await import('../../src/web/ui/domains/workspaces/services/factories.js');
    saveFactories([factoryA]);
    saveActiveFactoryId('factory-1');
    expect(localStorage.getItem('mastracode-factories')).toContain('factory-1');
    expect(localStorage.getItem('mastracode-active-factory')).toBe('factory-1');
    expect(localStorage.getItem('mastracode-projects')).toBeNull();
    expect(localStorage.getItem('mastracode-active-project')).toBeNull();

    localStorage.setItem(
      'mastracode-factories',
      JSON.stringify([{ id: 'flat', name: 'Flat', path: '/flat', source: 'local', createdAt: 1 }]),
    );
    expect(loadFactories()).toEqual([]);
    expect(loadActiveFactoryId()).toBe('factory-1');
  });
});
