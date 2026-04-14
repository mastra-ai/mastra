import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockGetToken = vi.fn().mockResolvedValue('tok');
const mockGetCurrentOrgId = vi.fn().mockResolvedValue('org-default');

vi.mock('../auth/credentials.js', () => ({
  getToken: mockGetToken,
  getCurrentOrgId: mockGetCurrentOrgId,
}));

const mockFetchServerProjects = vi.fn();
const mockGetServerProjectEnv = vi.fn();
const mockUpdateServerProjectEnv = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchServerProjects: mockFetchServerProjects,
  getServerProjectEnv: mockGetServerProjectEnv,
  updateServerProjectEnv: mockUpdateServerProjectEnv,
}));

const mockLoadProjectConfig = vi.fn();

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: mockLoadProjectConfig,
}));

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockChmod = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  chmod: mockChmod,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('tok');
  mockGetCurrentOrgId.mockResolvedValue('org-default');
});

afterEach(() => {
  delete process.env.MASTRA_ORG_ID;
  delete process.env.MASTRA_PROJECT_ID;
});

describe('resolveAuth', () => {
  it('prefers MASTRA_ORG_ID over --org', async () => {
    process.env.MASTRA_ORG_ID = 'env-org';
    const { resolveAuth } = await import('./env.js');
    await expect(resolveAuth('cli-org')).resolves.toEqual({ token: 'tok', orgId: 'env-org' });
  });

  it('uses cli org when MASTRA_ORG_ID unset', async () => {
    const { resolveAuth } = await import('./env.js');
    await expect(resolveAuth('cli-org')).resolves.toEqual({ token: 'tok', orgId: 'cli-org' });
  });

  it('falls back to getCurrentOrgId', async () => {
    const { resolveAuth } = await import('./env.js');
    await expect(resolveAuth(undefined)).resolves.toEqual({ token: 'tok', orgId: 'org-default' });
  });

  it('throws when no org can be resolved', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    const { resolveAuth } = await import('./env.js');
    await expect(resolveAuth(undefined)).rejects.toThrow('No organization selected');
  });
});

describe('resolveProjectId', () => {
  it('uses MASTRA_PROJECT_ID when set', async () => {
    process.env.MASTRA_PROJECT_ID = 'from-env';
    const { resolveProjectId } = await import('./env.js');
    await expect(resolveProjectId({})).resolves.toBe('from-env');
    expect(mockLoadProjectConfig).not.toHaveBeenCalled();
  });

  it('resolves slug via fetchServerProjects when auth provided', async () => {
    mockFetchServerProjects.mockResolvedValue([{ id: 'uuid-1', name: 'App', slug: 'my-app', organizationId: 'org-1' }]);
    const { resolveProjectId } = await import('./env.js');
    await expect(resolveProjectId({ project: 'my-app' }, { token: 'tok', orgId: 'org-1' })).resolves.toBe('uuid-1');
    expect(mockFetchServerProjects).toHaveBeenCalledWith('tok', 'org-1');
  });

  it('returns project option as-is when no auth (id passthrough)', async () => {
    const { resolveProjectId } = await import('./env.js');
    await expect(resolveProjectId({ project: 'raw-id' })).resolves.toBe('raw-id');
    expect(mockFetchServerProjects).not.toHaveBeenCalled();
  });

  it('uses linked project from config', async () => {
    mockLoadProjectConfig.mockResolvedValue({ projectId: 'cfg-proj' });
    const { resolveProjectId } = await import('./env.js');
    await expect(resolveProjectId({ config: '.mastra/mastra.json' })).resolves.toBe('cfg-proj');
  });

  it('throws when config has no projectId', async () => {
    mockLoadProjectConfig.mockResolvedValue({});
    const { resolveProjectId } = await import('./env.js');
    await expect(resolveProjectId({})).rejects.toThrow('No linked project found');
  });
});

describe('envListAction', () => {
  beforeEach(() => {
    process.env.MASTRA_PROJECT_ID = 'proj-x';
  });

  it('prints empty message when no vars', async () => {
    mockGetServerProjectEnv.mockResolvedValue({});
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envListAction } = await import('./env.js');
    await envListAction({});
    expect(spy.mock.calls.some(c => String(c[0]).includes('No environment variables'))).toBe(true);
    spy.mockRestore();
  });

  it('lists keys with masked values', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ SECRET: 'hunter2', SHORT: 'ab' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envListAction } = await import('./env.js');
    await envListAction({});
    const out = spy.mock.calls.map(c => c[0]).join('\n');
    expect(out).toContain('SECRET=hunt...');
    expect(out).toContain('SHORT=ab');
    spy.mockRestore();
  });
});

describe('envSetAction', () => {
  beforeEach(() => {
    process.env.MASTRA_PROJECT_ID = 'proj-x';
  });

  it('merges key and PUTs full env', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ A: '1' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envSetAction } = await import('./env.js');
    await envSetAction('B', '2', {});
    expect(mockUpdateServerProjectEnv).toHaveBeenCalledWith('tok', 'org-default', 'proj-x', {
      A: '1',
      B: '2',
    });
    expect(spy.mock.calls.some(c => String(c[0]).includes('Set B successfully'))).toBe(true);
    spy.mockRestore();
  });
});

describe('envUnsetAction', () => {
  beforeEach(() => {
    process.env.MASTRA_PROJECT_ID = 'proj-x';
  });

  it('prints when key missing', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ A: '1' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envUnsetAction } = await import('./env.js');
    await envUnsetAction('MISSING', {});
    expect(mockUpdateServerProjectEnv).not.toHaveBeenCalled();
    expect(spy.mock.calls.some(c => String(c[0]).includes('MISSING is not set'))).toBe(true);
    spy.mockRestore();
  });

  it('removes key and updates', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ A: '1', B: '2' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envUnsetAction } = await import('./env.js');
    await envUnsetAction('B', {});
    expect(mockUpdateServerProjectEnv).toHaveBeenCalledWith('tok', 'org-default', 'proj-x', {
      A: '1',
    });
    spy.mockRestore();
  });
});

describe('envImportAction', () => {
  it('throws when file unreadable', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const { envImportAction } = await import('./env.js');
    await expect(envImportAction('.env', {})).rejects.toThrow('Could not read file');
  });

  it('prints when file has no assignments', async () => {
    mockReadFile.mockResolvedValue('# only comments\n\n');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envImportAction } = await import('./env.js');
    await envImportAction('.env', {});
    expect(mockGetServerProjectEnv).not.toHaveBeenCalled();
    expect(spy.mock.calls.some(c => String(c[0]).includes('No variables found'))).toBe(true);
    spy.mockRestore();
  });

  it('merges parsed file into remote env', async () => {
    process.env.MASTRA_PROJECT_ID = 'proj-x';
    mockReadFile.mockResolvedValue('NEW=1\n');
    mockGetServerProjectEnv.mockResolvedValue({ OLD: '0' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envImportAction } = await import('./env.js');
    await envImportAction('.env', {});
    expect(mockUpdateServerProjectEnv).toHaveBeenCalledWith('tok', 'org-default', 'proj-x', {
      OLD: '0',
      NEW: '1',
    });
    expect(spy.mock.calls.some(c => String(c[0]).includes('Imported 1 variable'))).toBe(true);
    spy.mockRestore();
  });
});

describe('envPullAction', () => {
  beforeEach(() => {
    process.env.MASTRA_PROJECT_ID = 'proj-x';
    mockWriteFile.mockResolvedValue(undefined);
    mockChmod.mockResolvedValue(undefined);
  });

  it('writes empty env file when no vars exist', async () => {
    mockGetServerProjectEnv.mockResolvedValue({});
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction(undefined, {});
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('# Pulled from Mastra Server');
    expect(content).not.toMatch(/^\w+=.+$/m);
    expect(mockChmod).toHaveBeenCalled();
    expect(spy.mock.calls.some(c => String(c[0]).includes('Wrote empty'))).toBe(true);
    spy.mockRestore();
  });

  it('writes env vars to default .env file with restrictive permissions', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ DB_URL: 'postgres://localhost', API_KEY: 'secret' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction(undefined, {});
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content, options] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env');
    expect(content).toContain('# Pulled from Mastra Server');
    expect(content).toContain('API_KEY="secret"');
    expect(content).toContain('DB_URL="postgres://localhost"');
    expect(options).toEqual({ encoding: 'utf-8', mode: 0o600 });
    expect(mockChmod).toHaveBeenCalledWith(filePath, 0o600);
    expect(spy.mock.calls.some(c => String(c[0]).includes('Pulled 2 variable(s)'))).toBe(true);
    spy.mockRestore();
  });

  it('writes to a custom file when specified', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ FOO: 'bar' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction('.env.production', {});
    const [filePath, content] = mockWriteFile.mock.calls[0]!;
    expect(filePath).toContain('.env.production');
    expect(content).toContain('FOO="bar"');
    expect(spy.mock.calls.some(c => String(c[0]).includes('.env.production'))).toBe(true);
    spy.mockRestore();
  });

  it('quotes values containing special characters', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ SECRET: 'has spaces and "quotes"' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction(undefined, {});
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('SECRET="has spaces and \\"quotes\\""');
    spy.mockRestore();
  });

  it('escapes dollar signs, backticks, and control characters', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ TOKEN: 'price=$100`cmd`\nline2' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction(undefined, {});
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('TOKEN="price=\\$100\\`cmd\\`\\nline2"');
    spy.mockRestore();
  });

  it('skips keys that are not valid shell identifiers', async () => {
    mockGetServerProjectEnv.mockResolvedValue({ GOOD_KEY: 'ok', 'bad-key': 'nope', 'also bad': 'no' });
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { envPullAction } = await import('./env.js');
    await envPullAction(undefined, {});
    const [, content] = mockWriteFile.mock.calls[0]!;
    expect(content).toContain('GOOD_KEY="ok"');
    expect(content).not.toContain('bad-key=');
    expect(content).not.toContain('also bad=');
    expect(content).toContain('# Skipped unsafe key');
    expect(spy.mock.calls.some(c => String(c[0]).includes('Skipped 2 unsafe key(s)'))).toBe(true);
    spy.mockRestore();
  });
});
