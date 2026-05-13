import { fs, vol } from 'memfs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return {
    ...memfs.fs.promises,
    default: memfs.fs.promises,
  };
});

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: (v: unknown) => typeof v === 'symbol',
  log: { info: vi.fn() },
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn(),
  loadCredentials: vi.fn(),
}));

const { promptForObservability, writeObservabilityEnv } = await import('./utils');
const prompts = await import('@clack/prompts');
const { getToken, loadCredentials } = await import('../auth/credentials.js');

const selectMock = vi.mocked(prompts.select);
const getTokenMock = vi.mocked(getToken);
const loadCredentialsMock = vi.mocked(loadCredentials);

describe('promptForObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockResolvedValue('platform-token');
    loadCredentialsMock.mockResolvedValue(null);
  });

  test('starts platform auth immediately when observability is enabled', async () => {
    selectMock.mockResolvedValueOnce('yes' as never);

    await expect(promptForObservability()).resolves.toEqual({ enabled: true, token: 'platform-token' });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
  });

  test('does not start platform auth when observability is skipped', async () => {
    selectMock.mockResolvedValueOnce('no' as never);

    await expect(promptForObservability()).resolves.toEqual({ enabled: false });

    expect(getTokenMock).not.toHaveBeenCalled();
  });

  test('prints logged-in user when creds existed before getToken()', async () => {
    selectMock.mockResolvedValueOnce('yes' as never);
    const creds = {
      token: 'tok',
      user: { id: 'u1', email: 'existing@test.com', firstName: 'A', lastName: 'B' },
      organizationId: 'org-1',
    } as never;
    loadCredentialsMock.mockResolvedValueOnce(creds);
    loadCredentialsMock.mockResolvedValueOnce(creds);

    await promptForObservability();

    expect(vi.mocked(prompts.log.info)).toHaveBeenCalledWith('Logged in as existing@test.com');
  });

  test('does not print logged-in user when creds were created by login()', async () => {
    selectMock.mockResolvedValueOnce('yes' as never);
    loadCredentialsMock.mockResolvedValueOnce(null);

    await promptForObservability();

    expect(vi.mocked(prompts.log.info)).not.toHaveBeenCalled();
  });

  test('prints the post-auth user when stale creds force a fresh login as a different account', async () => {
    selectMock.mockResolvedValueOnce('yes' as never);
    // Pre-auth: stale creds for an old user
    loadCredentialsMock.mockResolvedValueOnce({
      token: 'stale',
      user: { id: 'u1', email: 'old@test.com', firstName: 'A', lastName: 'B' },
      organizationId: 'org-1',
    } as never);
    // Post-auth: new creds written by login() for a different user
    loadCredentialsMock.mockResolvedValueOnce({
      token: 'new',
      user: { id: 'u2', email: 'new@test.com', firstName: 'C', lastName: 'D' },
      organizationId: 'org-2',
    } as never);

    await promptForObservability();

    expect(vi.mocked(prompts.log.info)).toHaveBeenCalledWith('Logged in as new@test.com');
  });
});

describe('writeObservabilityEnv', () => {
  const cwd = '/mock-project';

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync(cwd, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  test('appends placeholder MASTRA_PLATFORM_ACCESS_TOKEN to .env', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n');

    await writeObservabilityEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('EXISTING=1');
    expect(contents).toContain('# Mastra Observability');
    expect(contents).toContain('MASTRA_PLATFORM_ACCESS_TOKEN=');
    expect(contents).not.toMatch(/MASTRA_PLATFORM_ACCESS_TOKEN=\S/);
  });

  test('writes a real token and project id when provided', async () => {
    fs.writeFileSync(`${cwd}/.env`, '');

    await writeObservabilityEnv({ token: 'sk_abc123', projectId: 'proj_xyz' });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_PLATFORM_ACCESS_TOKEN=sk_abc123');
    expect(contents).toContain('MASTRA_PROJECT_ID=proj_xyz');
    // No endpoint emitted unless explicitly passed.
    expect(contents).not.toContain('MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT');
  });

  test('writes the traces endpoint only when provided', async () => {
    fs.writeFileSync(`${cwd}/.env`, '');

    await writeObservabilityEnv({
      token: 'sk_abc',
      projectId: 'proj_x',
      endpoint: 'http://localhost:8080/projects/proj_x/ai/spans/publish',
    });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain(
      'MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT=http://localhost:8080/projects/proj_x/ai/spans/publish',
    );
  });

  test('creates the .env file if it does not exist', async () => {
    await writeObservabilityEnv();

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toContain('MASTRA_PLATFORM_ACCESS_TOKEN=');
    expect(contents).toContain('MASTRA_PROJECT_ID=');
  });
});
