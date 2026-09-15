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
  log: { info: vi.fn(), warn: vi.fn() },
}));

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn(),
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn(),
  loadCredentials: vi.fn(),
}));

vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: vi.fn(),
}));

const { getAPIKey, promptForObservability, writeAPIKey, writeObservabilityEnv, writeIndexFile } =
  await import('./utils');
const prompts = await import('@clack/prompts');
const { getToken, loadCredentials } = await import('../auth/credentials.js');
const { resolveCurrentOrg } = await import('../auth/orgs.js');

const selectMock = vi.mocked(prompts.select);
const getTokenMock = vi.mocked(getToken);
const loadCredentialsMock = vi.mocked(loadCredentials);
const resolveCurrentOrgMock = vi.mocked(resolveCurrentOrg);

describe('getAPIKey', () => {
  test('returns GOOGLE_API_KEY for Google provider', async () => {
    await expect(getAPIKey('google')).resolves.toBe('GOOGLE_API_KEY');
  });
});

describe('promptForObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockResolvedValue('platform-token');
    loadCredentialsMock.mockResolvedValue(null);
    resolveCurrentOrgMock.mockResolvedValue({ orgId: 'org_test', orgName: 'Test Org' });
  });

  test('starts platform auth and prompts for an org immediately when observability is enabled', async () => {
    selectMock.mockResolvedValueOnce('yes' as never);

    await expect(
      promptForObservability(undefined, event => trackEventMock('cli_observability_selected', event)),
    ).resolves.toEqual({
      enabled: true,
      token: 'platform-token',
      orgId: 'org_test',
      orgName: 'Test Org',
    });

    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(resolveCurrentOrgMock).toHaveBeenCalledWith('platform-token', { forcePrompt: true });
    expect(trackEventMock).toHaveBeenCalledWith('cli_observability_selected', {
      command: undefined,
      enabled: true,
      answer: 'yes',
      selection_method: 'interactive',
    });
  });

  test('does not start platform auth when observability is skipped', async () => {
    selectMock.mockResolvedValueOnce('no' as never);

    await expect(
      promptForObservability(undefined, event => trackEventMock('cli_observability_selected', event)),
    ).resolves.toEqual({
      enabled: false,
    });

    expect(getTokenMock).not.toHaveBeenCalled();
    expect(resolveCurrentOrgMock).not.toHaveBeenCalled();
    expect(trackEventMock).toHaveBeenCalledWith('cli_observability_selected', {
      command: undefined,
      enabled: false,
      answer: 'no',
      selection_method: 'interactive',
    });
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

  test('re-prompts the same question when the browser auth flow fails (e.g. user closed the browser)', async () => {
    // First attempt: user picks Yes, but auth fails (simulates closing the browser).
    // Second attempt: user picks No to skip observability.
    selectMock.mockResolvedValueOnce('yes' as never).mockResolvedValueOnce('no' as never);
    getTokenMock.mockRejectedValueOnce(new Error('Login timed out (60s)'));

    await expect(promptForObservability()).resolves.toEqual({ enabled: false });

    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prompts.log.warn)).toHaveBeenCalledWith(expect.stringContaining('Could not sign in to Mastra'));
  });

  test('eventually returns a token when a retried auth flow succeeds', async () => {
    selectMock.mockResolvedValueOnce('yes' as never).mockResolvedValueOnce('yes' as never);
    getTokenMock.mockRejectedValueOnce(new Error('Login timed out (60s)')).mockResolvedValueOnce('retry-token');

    await expect(promptForObservability()).resolves.toEqual({
      enabled: true,
      token: 'retry-token',
      orgId: 'org_test',
      orgName: 'Test Org',
    });

    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(getTokenMock).toHaveBeenCalledTimes(2);
  });

  test('returns {} when the user cancels the re-prompted question', async () => {
    const cancelSymbol = Symbol('clack:cancel');
    selectMock.mockResolvedValueOnce('yes' as never).mockResolvedValueOnce(cancelSymbol as never);
    getTokenMock.mockRejectedValueOnce(new Error('Login timed out (60s)'));

    await expect(promptForObservability()).resolves.toEqual({});

    expect(selectMock).toHaveBeenCalledTimes(2);
  });
});

describe('writeIndexFile', () => {
  const dirPath = '/mock-project/src/mastra';

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync(dirPath, { recursive: true });
  });

  test('example scaffold guards the local storage path behind TURSO_DATABASE_URL', async () => {
    await writeIndexFile({
      dirPath,
      addExample: true,
      addWorkflow: true,
      addAgent: true,
      addScorers: true,
    });

    const contents = fs.readFileSync(`${dirPath}/index.ts`, 'utf-8') as string;
    // Deploy preflight hard-blocks unguarded host-local storage URLs
    // (LOCAL_STORAGE_PATH). The guarded form deploys clean once a hosted
    // database provides TURSO_DATABASE_URL, and keeps the local file for dev.
    expect(contents).toContain('url: process.env.TURSO_DATABASE_URL ?? "file:./mastra.db"');
    expect(contents).toContain('authToken: process.env.TURSO_AUTH_TOKEN');
    expect(contents).not.toContain('url: "file:./mastra.db"');
  });
});

describe('writeAPIKey', () => {
  const cwd = '/mock-project';

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync(cwd, { recursive: true });
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  });

  test.each([
    ['sk-proj-abc123', 'plain key'],
    ['sk-proj-a+b/c=d', 'key containing ='],
    ['AIzaSyBx9K2mQ==', 'base64 padded key'],
    ['sk-proj-a"b&c|d', 'key containing shell metacharacters'],
  ])('writes %s verbatim (%s)', async apiKey => {
    await writeAPIKey({ provider: 'openai', apiKey });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toBe(`OPENAI_API_KEY=${apiKey}\n`);
  });

  test('writes a placeholder to .env.example when no key is given', async () => {
    await writeAPIKey({ provider: 'anthropic' });

    expect(fs.existsSync(`${cwd}/.env`)).toBe(false);
    const contents = fs.readFileSync(`${cwd}/.env.example`, 'utf-8') as string;
    expect(contents).toBe('ANTHROPIC_API_KEY=your-api-key\n');
  });

  test('appends without disturbing existing entries', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n');

    await writeAPIKey({ provider: 'openai', apiKey: 'sk-proj-abc123' });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf-8') as string;
    expect(contents).toBe('EXISTING=1\nOPENAI_API_KEY=sk-proj-abc123\n');
  });

  test('restricts permissions on an existing .env file', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n', { mode: 0o644 });

    await writeAPIKey({ provider: 'openai', apiKey: 'sk-proj-abc123' });

    if (process.platform !== 'win32') {
      expect(fs.statSync(`${cwd}/.env`).mode & 0o777).toBe(0o600);
    }
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
    expect(contents).toContain('# Mastra platform');
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

  test('writes to an explicit project path and preserves provider credentials', async () => {
    const projectPath = '/published-project';
    fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(`${projectPath}/.env`, 'ANTHROPIC_API_KEY=provider-secret\n');

    await writeObservabilityEnv({ projectPath, token: 'platform-secret', projectId: 'project-id' });

    expect(fs.existsSync(`${cwd}/.env`)).toBe(false);
    expect(fs.readFileSync(`${projectPath}/.env`, 'utf8')).toContain('ANTHROPIC_API_KEY=provider-secret');
    expect(fs.readFileSync(`${projectPath}/.env`, 'utf8')).toContain('MASTRA_PLATFORM_ACCESS_TOKEN=platform-secret');
  });

  test('updates existing Mastra platform values without duplicating assignments', async () => {
    fs.writeFileSync(
      `${cwd}/.env`,
      [
        'OPENAI_API_KEY=provider-secret',
        'MASTRA_PLATFORM_ACCESS_TOKEN=old-token',
        'MASTRA_PLATFORM_ACCESS_TOKEN=duplicate-token',
        'MASTRA_PROJECT_ID=old-project',
        '',
      ].join('\n'),
    );

    await writeObservabilityEnv({ token: 'new-token', projectId: 'new-project' });

    const contents = fs.readFileSync(`${cwd}/.env`, 'utf8') as string;
    expect(contents).toContain('OPENAI_API_KEY=provider-secret');
    expect(contents.match(/^MASTRA_PLATFORM_ACCESS_TOKEN=/gm)).toHaveLength(1);
    expect(contents).toContain('MASTRA_PLATFORM_ACCESS_TOKEN=new-token');
    expect(contents.match(/^MASTRA_PROJECT_ID=/gm)).toHaveLength(1);
    expect(contents).toContain('MASTRA_PROJECT_ID=new-project');
  });

  test.runIf(process.platform !== 'win32')('sets .env permissions to 0600', async () => {
    fs.writeFileSync(`${cwd}/.env`, 'EXISTING=1\n', { mode: 0o644 });

    await writeObservabilityEnv();

    expect(fs.statSync(`${cwd}/.env`).mode & 0o777).toBe(0o600);
  });
});
