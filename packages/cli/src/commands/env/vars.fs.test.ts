import { mkdtemp, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Environment } from './platform-api.js';

// `vars.test.ts` mocks `node:fs/promises` wholesale, so it can only assert which
// flags get passed to writeFile — it would stay green against a filesystem that
// truncated the file anyway. These tests use the real filesystem so the actual
// guarantee (an existing env file survives a pull without --force) is pinned.

const mockGetToken = vi.fn();

vi.mock('../auth/credentials.js', () => ({
  getToken: mockGetToken,
}));

const mockResolveCurrentOrg = vi.fn();

vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: mockResolveCurrentOrg,
}));

const mockResolveProject = vi.fn();

vi.mock('./resolve-project.js', () => ({
  resolveProject: mockResolveProject,
}));

const mockFetchEnvironments = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchEnvironments: mockFetchEnvironments,
}));

const mockGetServerProjectEnv = vi.fn();

vi.mock('../server/platform-api.js', () => ({
  getServerProjectEnv: mockGetServerProjectEnv,
}));

function environment(overrides: Partial<Environment>): Environment {
  return {
    id: 'env-1',
    projectId: 'proj-1',
    name: 'Production',
    slug: 'my-app',
    type: 'production',
    region: null,
    branch: null,
    instanceUrl: null,
    customServerUrl: null,
    observabilityProjectId: null,
    envVars: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

async function tempEnvPath(name = '.env'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-env-pull-'));
  return join(dir, name);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('tok');
  mockResolveCurrentOrg.mockResolvedValue({ orgId: 'org-1', orgName: 'Org' });
  mockResolveProject.mockResolvedValue({ id: 'proj-1', name: 'My App', slug: 'my-app', organizationId: 'org-1' });
  mockGetServerProjectEnv.mockResolvedValue({});
  mockFetchEnvironments.mockResolvedValue([environment({ envVars: { PULLED: 'from-cloud' } })]);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('envVarsPullAction against a real filesystem', () => {
  it('leaves an existing env file completely untouched when --force is not passed', async () => {
    const outputPath = await tempEnvPath();
    const original = 'LOCAL_ONLY="secret-that-must-survive"\n';
    await writeFile(outputPath, original, { mode: 0o644 });

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, { output: outputPath })).rejects.toThrow(
      /Refusing to overwrite .*\. Re-run with --force to replace it\./,
    );

    expect(await readFile(outputPath, 'utf-8')).toBe(original);
    // The refusal path must not chmod a file it did not write.
    expect((await stat(outputPath)).mode & 0o777).toBe(0o644);
  });

  it('creates a new file with 0600 permissions', async () => {
    const outputPath = await tempEnvPath();

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, { output: outputPath });

    expect(await readFile(outputPath, 'utf-8')).toContain('PULLED="from-cloud"');
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });

  it('--force replaces the file and re-tightens permissions to 0600', async () => {
    const outputPath = await tempEnvPath();
    // writeFile's `mode` only applies on creation, so an existing 0644 file keeps
    // its permissions through the overwrite — the trailing chmod is what fixes it.
    await writeFile(outputPath, 'STALE="value"\n', { mode: 0o644 });

    const { envVarsPullAction } = await import('./vars.js');
    await envVarsPullAction(undefined, { output: outputPath, force: true });

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('PULLED="from-cloud"');
    expect(content).not.toContain('STALE');
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
  });

  it('refuses a symlinked output path without clobbering the link target', async () => {
    const linkPath = await tempEnvPath();
    const targetPath = join(linkPath, '..', 'real.env');
    const original = 'REAL="keep-me"\n';
    await writeFile(targetPath, original);
    await symlink(targetPath, linkPath);

    const { envVarsPullAction } = await import('./vars.js');
    await expect(envVarsPullAction(undefined, { output: linkPath })).rejects.toThrow(/Refusing to overwrite/);

    expect(await readFile(targetPath, 'utf-8')).toBe(original);
  });

  it('surfaces non-EEXIST write failures instead of reporting them as an overwrite', async () => {
    const outputPath = join(await tempEnvPath('nested'), 'missing-dir', '.env');

    const { envVarsPullAction } = await import('./vars.js');
    // A missing parent directory is ENOENT; mislabeling it "Refusing to overwrite"
    // would send users chasing a file that does not exist.
    await expect(envVarsPullAction(undefined, { output: outputPath })).rejects.toThrow(/ENOENT/);
  });
});

describe('registerEnvVarsCommands', () => {
  it('registers --force with a -f short flag on `env vars pull`', async () => {
    const { registerEnvVarsCommands } = await import('./vars.js');
    const env = new Command('env');
    registerEnvVarsCommands(env);

    const pull = env.commands.find(c => c.name() === 'vars')?.commands.find(c => c.name() === 'pull');
    const force = pull?.options.find(o => o.long === '--force');

    // Every other test calls envVarsPullAction directly, so a flag registered
    // under the wrong name would otherwise go unnoticed.
    expect(force?.flags).toBe('-f, --force');
    expect(force?.short).toBe('-f');
    expect(force?.required).toBe(false);
  });
});
