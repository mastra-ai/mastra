import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { isolatedNpmEnv, startLocalRegistry } from './__tests__/local-registry.js';
import type { LocalRegistry } from './__tests__/local-registry.js';
import { resolveFeatureModule } from './load.js';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const loadUrl = new URL('./load.ts', import.meta.url).href;
const eventsUrl = new URL('./events.ts', import.meta.url).href;
// From source, the pin is the workspace copy's version.
const PINNED = (createRequire(import.meta.url)('@mastra/fastembed/package.json') as { version: string }).version;

let registry: LocalRegistry;
let npm: ReturnType<typeof isolatedNpmEnv>;
let root: string;
let scratch: string;

beforeAll(async () => {
  registry = await startLocalRegistry([
    {
      name: '@mastra/fastembed',
      version: PINNED,
      manifest: { exports: { '.': './index.mjs' } },
      files: { 'index.mjs': 'export const fastembed = {};\n' },
    },
  ]);
}, 60_000);

afterAll(async () => {
  await registry.close();
});

beforeEach(() => {
  npm = isolatedNpmEnv();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-features-root-'));
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-features-proc-'));
  registry.requests.length = 0;
});

afterEach(() => {
  npm.cleanup();
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(scratch, { recursive: true, force: true });
});

interface ProcessResult {
  url?: string;
  reason?: string;
  events: { status: string }[];
}

/**
 * Resolves the embedder in a fresh Mastra Code process where `@mastra/fastembed` is not installed next to
 * the SDK, as in a published `npm i mastracode`. A resolve hook hides the workspace copy from the SDK; the
 * features directory still resolves it normally.
 */
async function resolveInFreshProcess(opts: { configured?: 'auto' | 'never'; env?: string }): Promise<ProcessResult> {
  const hook = path.join(scratch, 'not-installed-with-sdk.mjs');
  fs.writeFileSync(
    hook,
    `import { registerHooks } from 'node:module';
    registerHooks({
      resolve(specifier, context, next) {
        if (specifier === '@mastra/fastembed' && context.parentURL?.startsWith(${JSON.stringify(pathToFileURL(packageDir).href)})) {
          throw Object.assign(new Error('Cannot find package @mastra/fastembed'), { code: 'ERR_MODULE_NOT_FOUND' });
        }
        return next(specifier, context);
      },
    });\n`,
  );
  const script = path.join(scratch, 'resolve.mjs');
  fs.writeFileSync(
    script,
    `import { resolveFeatureModule, setFeatureInstallPolicy } from ${JSON.stringify(loadUrl)};
    import { onFeatureInstall } from ${JSON.stringify(eventsUrl)};
    const events = [];
    onFeatureInstall(event => events.push(event));
    ${opts.configured ? `setFeatureInstallPolicy(${JSON.stringify(opts.configured)});` : ''}
    const out = await resolveFeatureModule('embeddings', '@mastra/fastembed').then(
      url => ({ url, events }),
      error => ({ reason: error.reason, events }),
    );
    process.stdout.write(JSON.stringify(out));\n`,
  );
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...npm.env,
    npm_config_registry: registry.url,
    MASTRACODE_FEATURES_DIR: root,
    MASTRACODE_FEATURE_INSTALL: opts.env,
  };
  const child = spawn(process.execPath, ['--import', 'tsx', '--import', hook, script], {
    cwd: packageDir,
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let out = '';
  child.stdout.on('data', chunk => (out += chunk));
  const code = await new Promise(resolve => child.once('exit', resolve));
  expect(code).toBe(0);
  return JSON.parse(out) as ProcessResult;
}

const tarballRequests = () => registry.requests.filter(url => url.startsWith('/-/tarball/'));

describe('resolving a feature module', () => {
  it('uses a copy installed next to mastracode and never downloads', async () => {
    process.env.MASTRACODE_FEATURES_DIR = root;
    try {
      const url = await resolveFeatureModule('embeddings', '@mastra/fastembed');
      expect(url).toBe(import.meta.resolve('@mastra/fastembed'));
    } finally {
      delete process.env.MASTRACODE_FEATURES_DIR;
    }
    expect(registry.requests).toEqual([]);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('installs on first use, then a later process reuses the install without downloading', async () => {
    const first = await resolveInFreshProcess({});
    expect(first.events.map(e => e.status)).toEqual(['started', 'completed']);
    expect(fileURLToPath(first.url!).startsWith(fs.realpathSync(root))).toBe(true);
    expect(tarballRequests()).toEqual([`/-/tarball/@mastra/fastembed@${PINNED}`]);

    registry.requests.length = 0;
    const second = await resolveInFreshProcess({});
    expect(second).toEqual({ url: first.url, events: [] });
    expect(registry.requests).toEqual([]);
  }, 120_000);

  it("featureInstall: 'never' reports the feature as disabled and downloads nothing", async () => {
    const result = await resolveInFreshProcess({ configured: 'never' });

    expect(result.reason).toBe('disabled');
    expect(result.events.map(e => e.status)).toEqual(['disabled']);
    expect(registry.requests).toEqual([]);
    expect(fs.readdirSync(root)).toEqual([]);
  }, 60_000);

  it('MASTRACODE_FEATURE_INSTALL overrides featureInstall in both directions', async () => {
    const offByEnv = await resolveInFreshProcess({ configured: 'auto', env: 'never' });
    expect(offByEnv.reason).toBe('disabled');
    expect(registry.requests).toEqual([]);

    const onByEnv = await resolveInFreshProcess({ configured: 'never', env: 'auto' });
    expect(onByEnv.events.map(e => e.status)).toEqual(['started', 'completed']);
    expect(fileURLToPath(onByEnv.url!).startsWith(fs.realpathSync(root))).toBe(true);
  }, 120_000);
});
