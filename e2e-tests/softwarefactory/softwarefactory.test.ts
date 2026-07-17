import { mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const cliRoot = join(rootDir, 'mastracode', 'create-softwarefactory');

/**
 * Validates the artifacts users receive from `npm create softwarefactory`
 * against the monorepo's local package set (served by the E2E registry):
 * generate the template from mastracode/web, scaffold with the CLI's
 * --default path, then typecheck, build, boot, and probe the scaffold.
 *
 * Published-npm compatibility is intentionally NOT checked here — sources
 * may legitimately be ahead of npm between release trains. The
 * sync-softwarefactory-template workflow gates the public template repo on
 * published versions instead.
 */
describe('softwarefactory template', () => {
  let workDir: string;
  let scaffoldDir: string;
  let registryEnv: Record<string, string>;

  beforeAll(async () => {
    const registry = inject('registry');
    const tag = inject('tag');
    // npm honors npm_config_registry; pnpm (which the CLI uses when invoked
    // from a pnpm script) wants the pnpm_config_ prefix.
    registryEnv = { npm_config_registry: registry, pnpm_config_registry: registry };

    workDir = await realpath(await mkdtemp(join(tmpdir(), 'sf-e2e-')));
    const templateDir = join(workDir, 'template');
    scaffoldDir = join(workDir, 'factory');

    // The CLI bin runs from dist; build it (cheap, tsup).
    await execa('pnpm', ['--filter', './mastracode/create-softwarefactory', 'build'], {
      cwd: rootDir,
      stdio: 'inherit',
    });

    // Generate the template pinned to the registry's snapshot dist-tag.
    await execa('node', [join(cliRoot, 'scripts', 'sync-template.mjs'), '--out', templateDir, '--tag', tag], {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, ...registryEnv },
    });

    // Scaffold a project with the CLI's --default path (installs via npm).
    await execa('node', [join(cliRoot, 'bin', 'cli.mjs'), 'factory', '--default', '--template-dir', templateDir], {
      cwd: workDir,
      stdio: 'inherit',
      env: { ...process.env, ...registryEnv, MASTRA_TELEMETRY_DISABLED: '1' },
    });
  });

  it('writes a healthy .env', async () => {
    const env = await readFile(join(scaffoldDir, '.env'), 'utf8');
    expect(env).toMatch(/^MASTRACODE_PUBLIC_URL=http:\/\/localhost:5173$/m);
    expect(env).toMatch(/^APP_DATABASE_URL=/m);
    // Unset vars must stay commented placeholders: an active `KEY=` loads as
    // the empty string and poisons `process.env.X ?? default` fallbacks.
    expect(env).toMatch(/^# WORKOS_API_KEY=/m);
    expect(env).not.toMatch(/^[A-Z][A-Z0-9_]*=$/m);
  });

  it('typechecks against the local package set', async () => {
    await execa('npm', ['run', 'check'], {
      cwd: scaffoldDir,
      stdio: 'inherit',
      env: { ...process.env, ...registryEnv },
    });
  });

  it('builds the UI and server', async () => {
    await execa('npm', ['run', 'build'], {
      cwd: scaffoldDir,
      stdio: 'inherit',
      env: { ...process.env, ...registryEnv },
    });
  });

  it('boots the dev servers and serves UI/API/proxied routes', async () => {
    const apiPort = await getPort();
    const uiPort = await getPort();

    const dev = execa('npm', ['run', 'dev'], {
      cwd: scaffoldDir,
      env: {
        ...process.env,
        ...registryEnv,
        PORT: String(apiPort),
        MASTRACODE_UI_PORT: String(uiPort),
      },
      detached: true,
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
      all: true,
    });

    try {
      const deadline = Date.now() + 5 * 60 * 1000;
      let ready = false;
      while (Date.now() < deadline) {
        try {
          const [ui, api] = await Promise.all([
            fetch(`http://localhost:${uiPort}/`),
            fetch(`http://localhost:${apiPort}/api`),
          ]);
          if (ui.ok && api.ok) {
            ready = true;
            break;
          }
        } catch {
          // Not up yet.
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!ready) {
        const result = await Promise.race([dev, Promise.resolve(null)]);
        throw new Error(
          `Dev server did not become ready on ui:${uiPort} api:${apiPort}.\n${result?.all ?? '(still running, no output captured)'}`,
        );
      }

      // Web-surface route proxied through the Vite dev server.
      const providers = await fetch(`http://localhost:${uiPort}/web/config/providers`);
      expect(providers.status).toBe(200);
    } finally {
      if (dev.pid) {
        try {
          process.kill(-dev.pid, 'SIGTERM');
        } catch {
          dev.kill('SIGTERM');
        }
      }
      await dev.catch(() => {});
    }
  });
});
