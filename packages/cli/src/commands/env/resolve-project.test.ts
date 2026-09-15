import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveProject } from './resolve-project.js';

vi.mock('./platform-api.js', () => ({
  fetchProjects: vi.fn(),
}));

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: vi.fn(),
}));

const { fetchProjects } = await import('./platform-api.js');
const { loadProjectConfig } = await import('../studio/project-config.js');

const projects = [
  { id: 'proj-1', name: 'My App', slug: 'my-app' },
  { id: 'proj-2', name: 'Other', slug: 'other' },
];

describe('resolveProject', () => {
  beforeEach(() => {
    vi.mocked(fetchProjects).mockResolvedValue(projects as never);
    vi.mocked(loadProjectConfig).mockResolvedValue(null as never);
    delete process.env.MASTRA_PROJECT_ID;
  });

  afterEach(() => {
    delete process.env.MASTRA_PROJECT_ID;
    vi.clearAllMocks();
  });

  it('resolves from the --project flag by id, name, or slug', async () => {
    expect((await resolveProject('t', 'org', 'proj-2')).id).toBe('proj-2');
    expect((await resolveProject('t', 'org', 'My App')).id).toBe('proj-1');
    expect((await resolveProject('t', 'org', 'my-app')).id).toBe('proj-1');
  });

  it('prefers MASTRA_PROJECT_ID over the flag', async () => {
    process.env.MASTRA_PROJECT_ID = 'proj-2';
    expect((await resolveProject('t', 'org', 'my-app')).id).toBe('proj-2');
  });

  it('falls back to the linked .mastra-project.json', async () => {
    vi.mocked(loadProjectConfig).mockResolvedValue({ projectId: 'proj-1' } as never);
    expect((await resolveProject('t', 'org')).id).toBe('proj-1');
  });

  it('throws a clear error when the flagged project does not exist', async () => {
    await expect(resolveProject('t', 'org', 'missing')).rejects.toThrow('Project not found: missing');
  });

  it('throws a guidance error when nothing resolves the project', async () => {
    await expect(resolveProject('t', 'org')).rejects.toThrow(
      'Pass --project <name|slug|id>, set MASTRA_PROJECT_ID, or run from a directory with a linked .mastra-project.json.',
    );
  });
});
