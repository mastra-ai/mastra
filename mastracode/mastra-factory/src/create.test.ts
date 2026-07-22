import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  isCancel: (value: unknown) => value === Symbol.for('clack.cancel'),
  log: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), message: vi.fn(), error: vi.fn() },
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

const exec = vi.hoisted(() => ({
  runInherit: vi.fn(),
  execFileAsync: vi.fn(),
}));

const platform = vi.hoisted(() => ({
  createServerProject: vi.fn(),
  mintOrgApiKey: vi.fn(),
  attachNeonDatabase: vi.fn(),
  waitForDatabaseReady: vi.fn(),
  getDatabaseConnection: vi.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const cliAuth = vi.hoisted(() => ({
  getToken: vi.fn(),
  resolveCurrentOrg: vi.fn(),
  fetchOrgs: vi.fn(),
  MASTRA_PLATFORM_API_URL: 'https://platform.example.test',
}));

vi.mock('@clack/prompts', () => clack);
vi.mock('./utils/exec.js', () => exec);
vi.mock('./platform.js', () => platform);
vi.mock('mastra/internal/auth', () => cliAuth);

import type { Analytics } from './analytics.js';
import { create } from './create.js';

const analytics = { trackEvent: () => {}, shutdown: async () => {} } as unknown as Analytics;

const ENV_EXAMPLE = `# Mastra Software Factory environment.

# MASTRACODE_PUBLIC_URL=

# APP_DATABASE_URL=

# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# WORKOS_API_KEY=
# WORKOS_CLIENT_ID=

# GITHUB_APP_ID=
`;

let workDir: string;
let templateDir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  vi.clearAllMocks();
  exec.runInherit.mockResolvedValue(undefined);
  exec.execFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

  // Sensible default: platform provisioning succeeds. Tests can override.
  cliAuth.getToken.mockResolvedValue('wos-token');
  cliAuth.resolveCurrentOrg.mockResolvedValue({ orgId: 'org_123', orgName: 'Acme' });
  cliAuth.fetchOrgs.mockResolvedValue([
    { id: 'org_123', name: 'Acme', role: 'admin', isCurrent: true },
    { id: 'org_456', name: 'Beta', role: 'member', isCurrent: false },
  ]);
  platform.createServerProject.mockResolvedValue({ id: 'proj_abc', slug: 'my-factory', name: 'my-factory' });
  platform.mintOrgApiKey.mockResolvedValue('sk_live_test');
  platform.attachNeonDatabase.mockResolvedValue({ id: 'db_1', status: 'provisioning', error: null });
  platform.waitForDatabaseReady.mockResolvedValue({ id: 'db_1', status: 'ready', error: null });
  platform.getDatabaseConnection.mockResolvedValue({
    envVars: [{ name: 'DATABASE_URL', value: 'postgres://user:pass@host/neon', secret: true }],
  });

  // realpath: macOS tmpdir is a symlink and cwd-relative paths resolve it.
  workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-create-test-')));
  templateDir = path.join(workDir, 'template-fixture');
  fs.mkdirSync(templateDir);
  fs.writeFileSync(
    path.join(templateDir, 'package.json'),
    `${JSON.stringify({ name: 'mastra-software-factory', version: '0.1.0', private: true }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(templateDir, '.env.example'), ENV_EXAMPLE);
  process.chdir(workDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('create --default --no-platform', () => {
  it('scaffolds a project with a verbatim .env and finishes with the success outro', async () => {
    await create({
      projectName: 'my-factory',
      useDefaults: true,
      templateDir,
      noPlatform: true,
      analytics,
    });

    const projectPath = path.join(workDir, 'my-factory');
    const env = fs.readFileSync(path.join(projectPath, '.env'), 'utf8');

    // With --no-platform, .env stays a verbatim copy of .env.example — the
    // CLI writes no values. Everything stays a commented placeholder (an
    // active `KEY=` would load as the empty string and poison
    // `process.env.X ?? default` fallbacks).
    expect(env).toBe(ENV_EXAMPLE);
    expect(env).not.toMatch(/^[A-Z][A-Z0-9_]*=/m);

    // Project renamed and installed.
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-factory');
    expect(exec.runInherit).toHaveBeenCalledWith(
      expect.any(String),
      ['install'],
      expect.objectContaining({
        cwd: projectPath,
      }),
    );

    // Git repo always initialized.
    expect(exec.runInherit).toHaveBeenCalledWith('git', ['init', '-q'], expect.objectContaining({ cwd: projectPath }));

    // Platform helpers never called with --no-platform.
    expect(cliAuth.getToken).not.toHaveBeenCalled();
    expect(platform.createServerProject).not.toHaveBeenCalled();

    // Success outro shown.
    expect(clack.note).toHaveBeenCalledWith(expect.stringContaining('Your Software Factory is ready!'), 'Next steps');
    expect(clack.outro).toHaveBeenCalled();
  });

  it('fails the run when the template clone fails, without a success outro', async () => {
    exec.execFileAsync.mockRejectedValue(new Error('remote unreachable'));

    await expect(create({ projectName: 'my-factory', useDefaults: true, noPlatform: true, analytics })).rejects.toThrow(
      /Failed to clone template/,
    );

    expect(exec.runInherit).not.toHaveBeenCalled();
    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });

  it('fails the run when dependency install fails, without a success outro', async () => {
    exec.runInherit.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args[0] === 'install') throw new Error('npm install exited with code 1');
    });

    await expect(
      create({ projectName: 'my-factory', useDefaults: true, templateDir, noPlatform: true, analytics }),
    ).rejects.toThrow(/retry manually/);

    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });
});

describe('create --default (platform provisioning)', () => {
  it('writes platform credentials to .env and shows the "Platform connected" outro', async () => {
    await create({ projectName: 'my-factory', useDefaults: true, templateDir, analytics });

    const projectPath = path.join(workDir, 'my-factory');
    const env = fs.readFileSync(path.join(projectPath, '.env'), 'utf8');

    // All five platform keys present with real values.
    expect(env).toMatch(/^MASTRA_SHARED_API_URL=https:\/\/platform\.example\.test$/m);
    expect(env).toMatch(/^MASTRA_ORGANIZATION_ID=org_123$/m);
    expect(env).toMatch(/^MASTRA_PROJECT_ID=proj_abc$/m);
    expect(env).toMatch(/^MASTRA_PLATFORM_SECRET_KEY=sk_live_test$/m);
    expect(env).toMatch(/^DATABASE_URL=postgres:\/\/user:pass@host\/neon$/m);

    // Other .env.example placeholders untouched.
    expect(env).toContain('# ANTHROPIC_API_KEY=');
    expect(env).toContain('# WORKOS_API_KEY=');

    // Platform pipeline hit in order.
    expect(cliAuth.getToken).toHaveBeenCalledTimes(1);
    expect(cliAuth.resolveCurrentOrg).toHaveBeenCalledWith('wos-token', { forcePrompt: true });
    expect(platform.createServerProject).toHaveBeenCalledWith({
      token: 'wos-token',
      orgId: 'org_123',
      name: 'my-factory',
    });
    expect(platform.mintOrgApiKey).toHaveBeenCalledWith({
      token: 'wos-token',
      orgId: 'org_123',
      keyName: 'create-factory: my-factory',
    });
    expect(platform.attachNeonDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj_abc',
        name: 'my-factory',
      }),
    );

    // Success outro mentions the connected project.
    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform connected.');
    expect(note).toContain('my-factory');
    expect(note).toContain('Acme');
  });

  it('surfaces a Neon 403 as a "need admin role" hint without failing the run', async () => {
    platform.attachNeonDatabase.mockRejectedValue(
      new platform.PlatformApiError(403, 'Attaching a database requires the admin role in your organization.'),
    );

    await create({ projectName: 'my-factory', useDefaults: true, templateDir, analytics });

    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform provisioning failed');
    expect(note).toContain('admin role');

    // Everything minted before the 403 should still be persisted so the
    // one-time `sk_` secret isn't lost. Only DATABASE_URL is missing.
    const env = fs.readFileSync(path.join(workDir, 'my-factory', '.env'), 'utf8');
    expect(env).toMatch(/^MASTRA_PROJECT_ID=proj_abc$/m);
    expect(env).toMatch(/^MASTRA_PLATFORM_SECRET_KEY=sk_live_test$/m);
    expect(env).not.toMatch(/^DATABASE_URL=/m);
  });

  it('persists the sk_ secret to .env when Neon provisioning fails after the key is minted', async () => {
    // Regression: previously, a Neon failure aborted before writeEnv ran, so
    // the freshly-minted (one-time) `sk_` key was thrown away.
    platform.waitForDatabaseReady.mockRejectedValue(
      new platform.PlatformApiError(504, 'Neon database is still provisioning after 60s.'),
    );

    await create({ projectName: 'my-factory', useDefaults: true, templateDir, analytics });

    const env = fs.readFileSync(path.join(workDir, 'my-factory', '.env'), 'utf8');
    expect(env).toMatch(/^MASTRA_SHARED_API_URL=/m);
    expect(env).toMatch(/^MASTRA_ORGANIZATION_ID=org_123$/m);
    expect(env).toMatch(/^MASTRA_PROJECT_ID=proj_abc$/m);
    expect(env).toMatch(/^MASTRA_PLATFORM_SECRET_KEY=sk_live_test$/m);
    expect(env).not.toMatch(/^DATABASE_URL=/m);

    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform provisioning failed');
    expect(note).toContain('still provisioning');
  });

  it('passes --region through to the Neon attach', async () => {
    await create({
      projectName: 'my-factory',
      useDefaults: true,
      templateDir,
      region: 'aws-us-east-2',
      analytics,
    });

    expect(platform.attachNeonDatabase).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'aws-us-east-2' }));
  });

  it('--org <name> skips the interactive picker and resolves via fetchOrgs', async () => {
    await create({
      projectName: 'my-factory',
      useDefaults: true,
      templateDir,
      org: 'Beta',
      analytics,
    });

    expect(cliAuth.fetchOrgs).toHaveBeenCalledTimes(1);
    expect(cliAuth.resolveCurrentOrg).not.toHaveBeenCalled();
    expect(platform.createServerProject).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org_456' }));
  });

  it('--org fails with a clear message when no org matches', async () => {
    await create({
      projectName: 'my-factory',
      useDefaults: true,
      templateDir,
      org: 'does-not-exist',
      analytics,
    });

    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform provisioning failed');
    expect(note).toContain('No organization matched --org');
    expect(platform.createServerProject).not.toHaveBeenCalled();
  });
});
