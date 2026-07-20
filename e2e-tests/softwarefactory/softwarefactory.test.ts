import { mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const cliRoot = join(rootDir, 'mastracode', 'mastra-factory');

/**
 * Validates the artifacts users receive from `npm create factory`
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
    await execa('pnpm', ['--filter', './mastracode/mastra-factory', 'build'], {
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

  it('seeds .env with commented placeholders only', async () => {
    const env = await readFile(join(scaffoldDir, '.env'), 'utf8');
    // The CLI writes no values — configuration happens in the web UI. Unset
    // vars must stay commented placeholders: an active empty `KEY=` loads as
    // the empty string and poisons `process.env.X ?? default` fallbacks.
    // (Non-empty schema defaults like MASTRACODE_SANDBOX_WORKDIR are fine.)
    expect(env).toMatch(/^# WORKOS_API_KEY=/m);
    expect(env).not.toMatch(/^[A-Z][A-Z0-9_]*=\s*$/m);
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
        // The Vite proxy targets :4111 by default; follow the API port.
        MASTRACODE_API_TARGET: `http://localhost:${apiPort}`,
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
      // The dev servers bind `localhost`, which lands on ::1 or 127.0.0.1
      // depending on the OS/Node resolver — accept whichever loopback answers.
      const probe = async (port: number, path: string) => {
        for (const host of ['localhost', '127.0.0.1', '[::1]']) {
          try {
            const res = await fetch(`http://${host}:${port}${path}`);
            if (res.ok) return res;
          } catch {
            // Try the next loopback address.
          }
        }
        return null;
      };

      const deadline = Date.now() + 5 * 60 * 1000;
      let ready = false;
      while (Date.now() < deadline && !devExited) {
        const [ui, api] = await Promise.all([probe(uiPort, '/'), probe(apiPort, '/api')]);
        if (ui && api) {
          ready = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!ready) {
        // Kill first so awaiting the (reject: false) result yields output.
        killDev();
        const result = await dev;
        throw new Error(`Dev server did not become ready on ui:${uiPort} api:${apiPort}.\n${result.all ?? ''}`);
      }

      // Web-surface route proxied through the Vite dev server.
      const providers = await probe(uiPort, '/web/config/providers');
      expect(providers?.status).toBe(200);
    } finally {
      killDev();
      await dev.catch(() => {});
    }
  });
});
