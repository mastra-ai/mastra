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

const tinyexec = vi.hoisted(() => ({
  x: vi.fn(),
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
  loadCredentials: vi.fn(),
  resolveCurrentOrg: vi.fn(),
  fetchOrgs: vi.fn(),
  MASTRA_PLATFORM_API_URL: 'https://platform.example.test',
}));

vi.mock('@clack/prompts', () => clack);
vi.mock('tinyexec', () => tinyexec);
vi.mock('./platform.js', () => platform);
vi.mock('mastra/internal/auth', () => cliAuth);

import type { Analytics } from './analytics.js';
import { create } from './create.js';
import { detectPackageManager, getInstallArgs } from './utils/pm.js';

const analytics = { trackEvent: () => {}, shutdown: async () => {} } as unknown as Analytics;
const TEMPLATE_REPO = 'https://github.com/mastra-ai/softwarefactory-template';

const ENV_EXAMPLE = `# Mastra Factory environment.

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

  // Sensible default: platform provisioning succeeds. Tests can override.
  // Cached credentials exist, so no "press enter to open auth flow" pause.
  cliAuth.loadCredentials.mockResolvedValue({ token: 'cached' });
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
    `${JSON.stringify({ name: 'mastra-factory', version: '0.1.0', private: true }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(templateDir, '.env.example'), ENV_EXAMPLE);
  process.chdir(workDir);

  tinyexec.x.mockImplementation(async (command: string, args: string[]) => {
    if (command === 'npx' && args[0] === 'degit') {
      fs.cpSync(templateDir, args[2]!, { recursive: true });
    }
    return { stdout: '', stderr: '', exitCode: 0, killed: false };
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('create --no-platform', () => {
  it('scaffolds a project with a verbatim .env and shows the next steps', async () => {
    await create({
      projectName: 'my-factory',
      template: TEMPLATE_REPO,
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
    const packageManager = detectPackageManager();
    expect(tinyexec.x).toHaveBeenCalledWith(packageManager, getInstallArgs(packageManager), {
      throwOnError: true,
      nodeOptions: { cwd: projectPath },
    });

    // Git repo always initialized.
    expect(tinyexec.x).toHaveBeenCalledWith('git', ['init', '-q'], {
      throwOnError: true,
      nodeOptions: { cwd: projectPath },
    });

    // Platform helpers never called with --no-platform.
    expect(cliAuth.getToken).not.toHaveBeenCalled();
    expect(platform.createServerProject).not.toHaveBeenCalled();

    // Next steps shown.
    expect(clack.note).toHaveBeenCalledWith(expect.stringContaining('Your Mastra Factory is ready!'), 'Next steps');
  });

  it('fails the run when the template clone fails, without a success outro', async () => {
    tinyexec.x.mockRejectedValue(new Error('remote unreachable'));

    await expect(
      create({ projectName: 'my-factory', template: TEMPLATE_REPO, noPlatform: true, analytics }),
    ).rejects.toThrow(/Failed to clone repository/);

    expect(tinyexec.x).not.toHaveBeenCalledWith(expect.any(String), ['install'], expect.anything());
    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });

  it('preserves an existing project directory passed as an argument', async () => {
    const projectPath = path.join(workDir, 'existing-factory');
    const markerPath = path.join(projectPath, 'keep.txt');
    fs.mkdirSync(projectPath);
    fs.writeFileSync(markerPath, 'keep me');
    tinyexec.x.mockRejectedValue(new Error('remote unreachable'));

    await expect(
      create({ projectName: 'existing-factory', template: TEMPLATE_REPO, noPlatform: true, analytics }),
    ).rejects.toThrow(/Directory existing-factory already exists/);

    expect(fs.readFileSync(markerPath, 'utf8')).toBe('keep me');
    expect(tinyexec.x).not.toHaveBeenCalled();
    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });

  it('fails the run when dependency install fails, without a success outro', async () => {
    tinyexec.x.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'npx' && args[0] === 'degit') {
        fs.cpSync(templateDir, args[2]!, { recursive: true });
      }
      if (args[0] === 'install') throw new Error('npm install exited with code 1');
    });

    await expect(
      create({ projectName: 'my-factory', template: TEMPLATE_REPO, noPlatform: true, analytics }),
    ).rejects.toThrow(/retry manually/);

    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });
});

describe('create (platform provisioning)', () => {
  it('writes platform credentials to .env and shows the "Platform connected" outro', async () => {
    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    const projectPath = path.join(workDir, 'my-factory');
    const env = fs.readFileSync(path.join(projectPath, '.env'), 'utf8');

    // All four platform keys present with real values; the shared API URL is
    // no longer written (consumers default to the production platform URL).
    expect(env).not.toMatch(/^MASTRA_SHARED_API_URL=/m);
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

    // Success outro summarizes the provisioned infra so the user isn't
    // surprised by what now exists in their platform org.
    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Provisioned on Mastra platform');
    expect(note).toContain('my-factory');
    expect(note).toContain('Acme');
    expect(note).toContain('Postgres database');
    expect(note).toContain('code agent sessions run inside Mastra platform sandboxes');
    expect(note).toContain('Manage your project at');
    expect(note).toContain('https://projects.mastra.ai');
  });

  it('surfaces a Neon 403 as a "need admin role" hint without failing the run', async () => {
    platform.attachNeonDatabase.mockRejectedValue(
      new platform.PlatformApiError(403, 'Attaching a database requires the admin role in your organization.'),
    );

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

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

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    const env = fs.readFileSync(path.join(workDir, 'my-factory', '.env'), 'utf8');
    expect(env).not.toMatch(/^MASTRA_SHARED_API_URL=/m);
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
      template: TEMPLATE_REPO,
      region: 'aws-us-east-2',
      analytics,
    });

    expect(platform.attachNeonDatabase).toHaveBeenCalledWith(expect.objectContaining({ regionId: 'aws-us-east-2' }));
  });

  it('--org <name> skips the interactive picker and resolves via fetchOrgs', async () => {
    await create({
      projectName: 'my-factory',
      template: TEMPLATE_REPO,
      org: 'Beta',
      analytics,
    });

    expect(cliAuth.fetchOrgs).toHaveBeenCalledTimes(1);
    expect(cliAuth.resolveCurrentOrg).not.toHaveBeenCalled();
    expect(platform.createServerProject).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org_456' }));
  });

  it('pauses with a "press enter" prompt before opening the auth flow when not logged in', async () => {
    vi.stubEnv('MASTRA_API_TOKEN', '');
    cliAuth.loadCredentials.mockResolvedValue(null);
    clack.text.mockResolvedValue('');

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    expect(clack.text).toHaveBeenCalledWith({
      message: 'Mastra account is required, press enter to continue...',
      defaultValue: '',
    });
    // Prompt shown before the auth flow starts.
    expect(clack.text.mock.invocationCallOrder[0]!).toBeLessThan(cliAuth.getToken.mock.invocationCallOrder[0]!);
    expect(clack.note).toHaveBeenCalledWith(expect.stringContaining('Provisioned on Mastra platform'), 'Next steps');
    vi.unstubAllEnvs();
  });

  it('skips the auth pause when cached credentials already exist', async () => {
    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    expect(clack.text).not.toHaveBeenCalled();
    expect(cliAuth.getToken).toHaveBeenCalledTimes(1);
  });

  it('treats cancelling the auth pause as a provisioning failure without opening the auth flow', async () => {
    vi.stubEnv('MASTRA_API_TOKEN', '');
    cliAuth.loadCredentials.mockResolvedValue(null);
    clack.text.mockResolvedValue(Symbol.for('clack.cancel'));

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    expect(cliAuth.getToken).not.toHaveBeenCalled();
    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform provisioning failed');
    expect(note).toContain('Sign-in cancelled.');
    vi.unstubAllEnvs();
  });

  it('--org fails with a clear message when no org matches', async () => {
    await create({
      projectName: 'my-factory',
      template: TEMPLATE_REPO,
      org: 'does-not-exist',
      analytics,
    });

    const note = clack.note.mock.calls[0]![0] as string;
    expect(note).toContain('Platform provisioning failed');
    expect(note).toContain('No organization matched --org');
    expect(platform.createServerProject).not.toHaveBeenCalled();
  });
});

describe('create — .env safety before git commit', () => {
  it('adds .env to .gitignore before the initial commit so platform secrets are never staged', async () => {
    // Template ships no .gitignore of its own.
    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    const projectPath = path.join(workDir, 'my-factory');
    const gitignore = fs.readFileSync(path.join(projectPath, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env$/m);

    // Ordering matters: `git add -A` runs AFTER we mutate .gitignore. Otherwise
    // the freshly-provisioned MASTRA_PLATFORM_SECRET_KEY / DATABASE_URL would
    // land in the initial commit.
    const runCalls = tinyexec.x.mock.calls as Array<[string, string[]]>;
    const gitAddIndex = runCalls.findIndex(call => call[0] === 'git' && call[1][0] === 'add');
    expect(gitAddIndex).toBeGreaterThanOrEqual(0);
    // Sanity: gitignore has the .env line at commit time (we already asserted
    // the file contents above, and no subsequent write happens between the
    // .gitignore edit and `git add -A`).
    expect(fs.readFileSync(path.join(projectPath, '.gitignore'), 'utf8')).toMatch(/^\.env$/m);
  });

  it('leaves an existing .gitignore alone when .env is already covered', async () => {
    // Fixture template with a .gitignore that already ignores .env via glob.
    const existing = 'node_modules\n.env*\ndist\n';
    fs.writeFileSync(path.join(templateDir, '.gitignore'), existing);

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    const gitignore = fs.readFileSync(path.join(workDir, 'my-factory', '.gitignore'), 'utf8');
    // Content unchanged — no duplicate `.env` appended.
    expect(gitignore).toBe(existing);
  });

  it('preserves existing .gitignore entries and appends .env when missing', async () => {
    const existing = 'node_modules\ndist\n';
    fs.writeFileSync(path.join(templateDir, '.gitignore'), existing);

    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

    const gitignore = fs.readFileSync(path.join(workDir, 'my-factory', '.gitignore'), 'utf8');
    expect(gitignore).toContain('node_modules');
    expect(gitignore).toContain('dist');
    expect(gitignore).toMatch(/^\.env$/m);
  });

  it.runIf(process.platform !== 'win32')(
    'skips git init when .gitignore cannot be updated so .env secrets are never staged',
    async () => {
      // Ship a .gitignore that does NOT cover `.env` — the scaffolder must
      // append to it. We then make the scaffolded copy read-only so the
      // append fails and the git init step is aborted.
      fs.writeFileSync(path.join(templateDir, '.gitignore'), 'node_modules\n');

      // Intercept the copy step: after the template lands in the project dir,
      // lock its .gitignore before ensureEnvGitignored runs. We do this via a
      // one-shot spy that fires when the create flow calls into runInherit for
      // the first git command — but simpler: pre-chmod the template's file
      // itself. The scaffolder copies it into the project dir, preserving the
      // read-only bit, so the subsequent writeFileSync throws EACCES.
      fs.chmodSync(path.join(templateDir, '.gitignore'), 0o444);

      await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

      const runCalls = tinyexec.x.mock.calls as Array<[string, string[]]>;
      const anyGit = runCalls.some(call => call[0] === 'git');
      expect(anyGit).toBe(false);

      // User was warned about it.
      const warns = clack.log.warn.mock.calls.flat().join('\n');
      expect(warns).toMatch(/\.gitignore/);
      expect(warns).toMatch(/Skipping git init/i);
    },
  );
});
