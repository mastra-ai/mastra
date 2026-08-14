import { mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import getPort from 'get-port';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');

/**
 * Validates the artifacts users receive from `npm create factory`
 * against the monorepo's local package set (served by the E2E registry):
 * scaffold with create-factory's built-in project, then typecheck, build the
 * CLI-bundled UI and server, boot, and probe the scaffold against the
 * monorepo's local package snapshot.
 */
describe('create-factory scaffold', () => {
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
    scaffoldDir = join(workDir, 'factory');

    // `pnpm --filter` bypasses turbo, so the embedded SPA that `build:lib`
    // builds below would resolve @mastra/* `exports` into unbuilt `dist/`.
    await execa('pnpm', ['run', 'prebuild'], {
      cwd: join(rootDir, 'mastracode', 'web'),
      stdio: 'inherit',
    });

    // Exercise the published create-factory artifact from the same isolated
    // registry snapshot as its Mastra dependency graph. Install into this
    // temporary project rather than using pnpm dlx, whose cache is shared
    // across registries for a given package tag.
    const storeDir = join(workDir, '.pnpm-store');
    const cacheDir = join(workDir, '.pnpm-cache');
    const packageMetadata = (await fetch(`${registry}/create-factory`).then(response => response.json())) as {
      'dist-tags': Record<string, string>;
    };
    const packageVersion = packageMetadata['dist-tags'][tag];
    await execa(
      'pnpm',
      [
        'add',
        `--config.registry=${registry}`,
        `--config.store-dir=${storeDir}`,
        `--config.cache-dir=${cacheDir}`,
        '--allow-build=esbuild',
        `create-factory@${packageVersion}`,
      ],
      {
        cwd: workDir,
        stdio: 'inherit',
        env: { ...process.env, ...registryEnv },
      },
    );
    await execa(join(workDir, 'node_modules/.bin/create-factory'), ['factory', '--no-platform'], {
      cwd: workDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...registryEnv,
        MASTRA_FACTORY_DEPENDENCY_TAG: tag,
        MASTRA_TELEMETRY_DISABLED: '1',
      },
    });
  });

  it('ships the current mastracode/web Factory source', async () => {
    const [generatedSource, webSource] = await Promise.all([
      readFile(join(scaffoldDir, 'src/mastra/index.ts'), 'utf8'),
      readFile(join(rootDir, 'mastracode/web/src/mastra/index.ts'), 'utf8'),
    ]);
    expect(generatedSource).toBe(webSource);
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

  it('builds the server and CLI-bundled UI', async () => {
    await execa('npm', ['run', 'build'], {
      cwd: scaffoldDir,
      stdio: 'inherit',
      env: { ...process.env, ...registryEnv },
    });
  });

  it('boots the dev server and serves UI and API routes', async () => {
    const port = await getPort();

    const dev = execa('npm', ['run', 'dev'], {
      cwd: scaffoldDir,
      env: {
        ...process.env,
        ...registryEnv,
        // This smoke test probes UI and API routes directly.
        MASTRACODE_AUTH_DISABLED: '1',
        PORT: String(port),
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
      const probe = async (port: number, path: string) => {
        for (const host of ['localhost', '127.0.0.1', '[::1]']) {
          try {
            // Bound each attempt: a hung request would otherwise stall the
            // poll loop past its deadline and lose the collected diagnostics.
            const res = await fetch(`http://${host}:${port}${path}`, { signal: AbortSignal.timeout(10_000) });
            // callers only read ok/status — release the socket immediately
            void res.body?.cancel().catch(() => {});
            lastProbe.set(path, `${host} -> ${res.status}`);
            if (res.ok) return res;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            lastProbe.set(path, `${host} -> ${message}`);
          }
        }
        return null;
      };

      // Probe a concrete API endpoint, matching the other E2E suites.
      const apiRoute = '/api/tools';

      const deadline = Date.now() + 5 * 60 * 1000;
      let ready = false;
      while (Date.now() < deadline && !devExited) {
        const [ui, api] = await Promise.all([probe(port, '/'), probe(port, apiRoute)]);
        if (ui && api) {
          ready = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (!ready) {
        // Read before killDev(), which resolves `dev` and flips devExited.
        const exited = devExited;
        const probes = [...lastProbe].map(([path, outcome]) => `${path} ${outcome}`).join(', ');
        killDev();
        const result = await dev;
        const detail = [exited && 'process exited', probes].filter(Boolean).join('; ') || 'no probe completed';
        throw new Error(`Dev server did not become ready on port ${port} (${detail}).\n${result.all ?? ''}`);
      }

      const providers = await probe(port, '/web/config/providers');
      if (!providers) {
        throw new Error(
          `Provider config endpoint did not respond successfully (${lastProbe.get('/web/config/providers') ?? 'no probe completed'})`,
        );
      }
      expect(providers.status).toBe(200);
    } finally {
      killDev();
      await dev.catch(() => {});
    }
  });
});
