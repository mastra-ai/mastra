import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const cliRoot = join(rootDir, 'mastracode', 'mastra-factory');

const TEMPLATES = ['template-factory', 'template-factory-self-hosted'] as const;
type TemplateName = (typeof TEMPLATES)[number];

/**
 * Validates the artifacts users receive from `npm create factory` against the
 * monorepo's local package set (served by the E2E registry): scaffold each
 * checked-in factory template through the built CLI, then typecheck and build
 * it. The self-hosted template is also booted against its own Postgres.
 *
 * Published-npm compatibility is intentionally NOT checked here — sources may
 * legitimately be ahead of npm between release trains. The sync-templates
 * workflow gates the public template repos on published versions instead.
 */
describe('factory templates', () => {
  let workDir: string;
  let registryEnv: Record<string, string>;
  const scaffoldDirs = {} as Record<TemplateName, string>;

  beforeAll(async () => {
    const registry = inject('registry');
    const tag = inject('tag');
    // npm honors npm_config_registry; pnpm (which the CLI uses when invoked
    // from a pnpm script) wants the pnpm_config_ prefix.
    registryEnv = { npm_config_registry: registry, pnpm_config_registry: registry };

    workDir = await realpath(await mkdtemp(join(tmpdir(), 'sf-e2e-')));

    // `pnpm --filter` bypasses turbo, so the embedded SPA that `build:lib`
    // builds below would resolve @mastra/* `exports` into unbuilt `dist/`.
    await execa('pnpm', ['run', 'prebuild'], {
      cwd: join(rootDir, 'mastracode', 'web'),
      stdio: 'inherit',
    });

    // The create-factory bundle externalizes its `mastra/internal/auth`
    // dependency, so both package dist directories must exist before it runs.
    await execa('pnpm', ['--filter', './packages/cli', 'build:lib'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    await execa('pnpm', ['--filter', './mastracode/mastra-factory', 'build'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    for (const name of TEMPLATES) {
      const templateDir = join(workDir, `${name}-source`);
      await cp(join(rootDir, 'templates', name), templateDir, { recursive: true });

      // Templates track `latest`; pin Mastra packages to the registry's
      // snapshot dist-tag so the scaffold installs the local package set.
      const manifestPath = join(templateDir, 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      for (const field of ['dependencies', 'devDependencies'] as const) {
        for (const dep of Object.keys(manifest[field] ?? {})) {
          if (dep === 'mastra' || dep.startsWith('@mastra/')) manifest[field][dep] = tag;
        }
      }
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      // Snapshot versions don't satisfy the packages' semver peer ranges.
      await writeFile(join(templateDir, '.npmrc'), 'legacy-peer-deps=true\n');

      // The CLI accepts a Git template source, so make the directory
      // cloneable and scaffold it through the built create-factory entrypoint.
      await execa('git', ['init', '-q', '-b', 'main'], { cwd: templateDir });
      await execa('git', ['add', '-A'], { cwd: templateDir });
      await execa(
        'git',
        ['-c', 'user.name=Software Factory E2E', '-c', 'user.email=e2e@mastra.ai', 'commit', '-q', '-m', 'Template'],
        { cwd: templateDir },
      );
      await execa('node', [join(cliRoot, 'dist', 'index.js'), name, '--no-platform', '--template', templateDir], {
        cwd: workDir,
        stdio: 'inherit',
        env: { ...process.env, ...registryEnv, MASTRA_TELEMETRY_DISABLED: '1' },
      });
      scaffoldDirs[name] = join(workDir, name);
    }
  });

  describe.each(TEMPLATES)('%s', name => {
    it('seeds .env with a generated encryption key and no empty values', async () => {
      const env = await readFile(join(scaffoldDirs[name], '.env'), 'utf8');
      const key = /^FACTORY_CREDENTIAL_ENCRYPTION_KEY=(.+)$/m.exec(env)?.[1];
      expect(Buffer.from(key ?? '', 'base64')).toHaveLength(32);
      // An active empty `KEY=` loads as the empty string and poisons
      // `process.env.X ?? default` fallbacks.
      expect(env).not.toMatch(/^[A-Z][A-Z0-9_]*=\s*$/m);
    });

    it('typechecks against the local package set', async () => {
      await execa('npm', ['run', 'check'], {
        cwd: scaffoldDirs[name],
        stdio: 'inherit',
        env: { ...process.env, ...registryEnv },
      });
    });

    it('builds the server and CLI-bundled UI', async () => {
      await execa('npm', ['run', 'build'], {
        cwd: scaffoldDirs[name],
        stdio: 'inherit',
        env: { ...process.env, ...registryEnv },
      });
    });
  });

  describe('template-factory-self-hosted dev server', () => {
    let dbStarted = false;

    afterAll(async () => {
      if (!dbStarted) return;
      await execa('docker', ['compose', 'down', '-v'], {
        cwd: scaffoldDirs['template-factory-self-hosted'],
        reject: false,
      });
    });

    it('boots against Postgres and serves the sign-in page behind WorkOS auth', async () => {
      const scaffoldDir = scaffoldDirs['template-factory-self-hosted'];
      await execa('npm', ['run', 'db:up'], { cwd: scaffoldDir, stdio: 'inherit' });
      dbStarted = true;

      const port = await getPort();
      const dev = execa('npm', ['run', 'dev'], {
        cwd: scaffoldDir,
        env: {
          ...process.env,
          ...registryEnv,
          PORT: String(port),
          MASTRACODE_PUBLIC_URL: `http://localhost:${port}`,
          DATABASE_URL: 'postgres://factory:factory@localhost:54330/factory',
          // FACTORY_CREDENTIAL_ENCRYPTION_KEY comes from the scaffolded .env.
          // Placeholder credentials: the server only contacts WorkOS and
          // GitHub when a user signs in or a webhook arrives.
          WORKOS_API_KEY: 'sk_test_e2e',
          WORKOS_CLIENT_ID: 'client_e2e',
          WORKOS_COOKIE_PASSWORD: randomBytes(32).toString('hex'),
          GITHUB_APP_ID: '1',
          GITHUB_APP_PRIVATE_KEY: 'e2e',
          GITHUB_APP_CLIENT_ID: 'e2e',
          GITHUB_APP_CLIENT_SECRET: 'e2e',
          GITHUB_APP_SLUG: 'e2e',
          GITHUB_APP_WEBHOOK_SECRET: 'e2e',
        },
        detached: true,
        stdout: 'pipe',
        stderr: 'pipe',
        reject: false,
        all: true,
      });

      let devExited = false;
      void dev.then(() => {
        devExited = true;
      });

      const killDev = () => {
        if (!dev.pid) return;
        try {
          process.kill(-dev.pid, 'SIGTERM');
        } catch {
          dev.kill('SIGTERM');
        }
      };

      try {
        // The dev server binds `localhost`, which lands on ::1 or 127.0.0.1
        // depending on the OS/Node resolver — accept whichever loopback answers.
        const lastProbe = new Map<string, string>();
        const probe = async (path: string, init: { status?: number; accept?: string } = {}) => {
          for (const host of ['localhost', '127.0.0.1', '[::1]']) {
            try {
              // Bound each attempt: a hung request would otherwise stall the
              // poll loop past its deadline and lose the collected diagnostics.
              const res = await fetch(`http://${host}:${port}${path}`, {
                headers: init.accept ? { accept: init.accept } : {},
                signal: AbortSignal.timeout(10_000),
              });
              lastProbe.set(path, `${host} -> ${res.status}`);
              if (init.status === undefined ? res.ok : res.status === init.status) return res;
              void res.body?.cancel().catch(() => {});
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              lastProbe.set(path, `${host} -> ${message}`);
            }
          }
          return null;
        };

        // Anonymous browsers land on the sign-in page; the API rejects them.
        const deadline = Date.now() + 5 * 60 * 1000;
        let signin: Response | null = null;
        let me: Response | null = null;
        let api: Response | null = null;
        while (Date.now() < deadline && !devExited) {
          [signin, me, api] = await Promise.all([
            probe('/signin', { accept: 'text/html' }),
            probe('/auth/me'),
            probe('/api/tools', { status: 401 }),
          ]);
          if (signin && me && api) break;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!signin || !me || !api) {
          // Read before killDev(), which resolves `dev` and flips devExited.
          const exited = devExited;
          const probes = [...lastProbe].map(([path, outcome]) => `${path} ${outcome}`).join(', ');
          killDev();
          const result = await dev;
          const detail = [exited && 'process exited', probes].filter(Boolean).join('; ') || 'no probe completed';
          throw new Error(`Dev server did not become ready on port ${port} (${detail}).\n${result.all ?? ''}`);
        }

        expect(await signin.text()).toContain('<title>Mastra Factory</title>');
        expect(await me.json()).toMatchObject({ authenticated: false, provider: 'workos' });
      } finally {
        killDev();
        await dev.catch(() => {});
      }
    });
  });
});
