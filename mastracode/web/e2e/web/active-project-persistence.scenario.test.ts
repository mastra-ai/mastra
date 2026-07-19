import { beforeEach, describe, it, expect, vi } from 'vitest';

/**
 * Reopening the web app must restore the previously active project so its
 * session reconnects and threads reappear — without the user re-selecting it.
 * This guards the regression where activeProjectId reset to null on reload.
 *
 * projects.ts is localStorage-driven and the scenario env is node, so we stub a
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

describe('active project persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
  });

  it('persists and restores the active project id', async () => {
    const { saveActiveProjectId, loadActiveProjectId } =
      await import('../../src/web/ui/domains/workspaces/services/projects.js');
    expect(loadActiveProjectId()).toBeNull();
    saveActiveProjectId('proj-1');
    expect(loadActiveProjectId()).toBe('proj-1');
  });

  it('clears the active id when null is saved', async () => {
    const { saveActiveProjectId, loadActiveProjectId } =
      await import('../../src/web/ui/domains/workspaces/services/projects.js');
    saveActiveProjectId('proj-1');
    saveActiveProjectId(null);
    expect(loadActiveProjectId()).toBeNull();
  });

  it('clears the active id when the active project is removed', async () => {
    const { saveProjects, saveActiveProjectId, loadActiveProjectId, removeProject } =
      await import('../../src/web/ui/domains/workspaces/services/projects.js');
    saveProjects([
      { id: 'proj-1', name: 'A', path: '/a', resourceId: 'mastra-aaa', createdAt: 1 },
      { id: 'proj-2', name: 'B', path: '/b', resourceId: 'mastra-bbb', createdAt: 2 },
    ]);
    saveActiveProjectId('proj-1');
    await removeProject('', 'proj-1');
    expect(loadActiveProjectId()).toBeNull();
  });

  it('leaves the active id alone when a different project is removed', async () => {
    const { saveProjects, saveActiveProjectId, loadActiveProjectId, removeProject } =
      await import('../../src/web/ui/domains/workspaces/services/projects.js');
    saveProjects([
      { id: 'proj-1', name: 'A', path: '/a', resourceId: 'mastra-aaa', createdAt: 1 },
      { id: 'proj-2', name: 'B', path: '/b', resourceId: 'mastra-bbb', createdAt: 2 },
    ]);
    saveActiveProjectId('proj-1');
    await removeProject('', 'proj-2');
    expect(loadActiveProjectId()).toBe('proj-1');
  });
});
