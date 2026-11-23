import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FastembedWorker } from '../agents/fastembed-subprocess.js';
import { closedPortUrl, isolatedNpmEnv, startLocalRegistry } from './__tests__/local-registry.js';
import type { LocalRegistry } from './__tests__/local-registry.js';
import { runFeaturesCommand } from './cli.js';
import { FeatureNotInstalledError } from './events.js';
import { findInstalledFeature, getFeatureDir, installFeature, resolveFromFeatureDir } from './install.js';
import type { FeatureInstallTarget } from './install.js';

// Stand-in for @mastra/fastembed with the same export shape. Each vector is [text length, 42].
const FAKE_FASTEMBED = {
  name: '@mastra/fastembed',
  manifest: { exports: { '.': './index.mjs' } },
  files: {
    'index.mjs': `export const fastembed = { small: { async doEmbed({ values }) {
      return { embeddings: values.map(v => [v.length, 42]), warnings: [] };
    } } };\n`,
  },
};
const PINNED = '1.4.0-alpha.0';

let registry: LocalRegistry;
let npm: ReturnType<typeof isolatedNpmEnv>;
let root: string;
const savedEnv = { ...process.env };

beforeAll(async () => {
  registry = await startLocalRegistry([
    { ...FAKE_FASTEMBED, version: PINNED },
    // A newer release exists; the pin must still win.
    { ...FAKE_FASTEMBED, version: '1.5.0' },
  ]);
}, 60_000);

afterAll(async () => {
  await registry.close();
});

beforeEach(() => {
  npm = isolatedNpmEnv();
  Object.assign(process.env, npm.env);
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-features-'));
  registry.requests.length = 0;
});

afterEach(() => {
  process.env = { ...savedEnv };
  npm.cleanup();
  fs.rmSync(root, { recursive: true, force: true });
});

function target(version = PINNED): FeatureInstallTarget {
  return { id: 'embeddings', packages: { '@mastra/fastembed': version }, versionDir: path.join(root, '1.0.0') };
}

const tarballRequests = () => registry.requests.filter(url => url.startsWith('/-/tarball/'));
const leftovers = () => fs.readdirSync(target().versionDir).filter(entry => entry.startsWith('.staging-'));

describe('first-use feature install', () => {
  it('installs the pinned embedder on first use, and the embedding worker runs from it', async () => {
    const dir = await installFeature(target(), { registry: registry.url });

    expect(dir).toBe(getFeatureDir(target()));
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, 'node_modules/@mastra/fastembed/package.json'), 'utf8')).version,
    ).toBe(PINNED);
    expect(tarballRequests()).toEqual([`/-/tarball/@mastra/fastembed@${PINNED}`]);

    const worker = new FastembedWorker(await resolveFromFeatureDir(dir, '@mastra/fastembed'));
    try {
      await expect(worker.embed({ values: ['hello'] })).resolves.toEqual({ embeddings: [[5, 42]], warnings: [] });
    } finally {
      worker.close();
    }
  }, 60_000);

  it('does not download again once installed', async () => {
    await installFeature(target(), { registry: registry.url });
    registry.requests.length = 0;

    expect(findInstalledFeature(target())).toBe(getFeatureDir(target()));
    await installFeature(target(), { registry: registry.url });
    expect(registry.requests).toEqual([]);
  }, 60_000);

  it('does not treat an install of another pinned version as this one', async () => {
    await installFeature(target(), { registry: registry.url });

    expect(findInstalledFeature(target('1.5.0'))).toBeUndefined();
    await installFeature(target('1.5.0'), { registry: registry.url });
    expect(findInstalledFeature(target('1.5.0'))).toBe(getFeatureDir(target()));
    expect(findInstalledFeature(target())).toBeUndefined();
  }, 60_000);

  it('installs once when two sessions need the feature at the same time', async () => {
    const [a, b] = await Promise.all([
      installFeature(target(), { registry: registry.url }),
      installFeature(target(), { registry: registry.url }),
    ]);

    expect(a).toBe(b);
    expect(tarballRequests()).toHaveLength(1);
    expect(leftovers()).toEqual([]);
  }, 60_000);

  it('recovers from an install that crashed half way (stale lock and partial directory)', async () => {
    const { versionDir } = target();
    fs.mkdirSync(path.join(versionDir, '.lock-embeddings'), { recursive: true });
    // A pid that cannot be running.
    fs.writeFileSync(
      path.join(versionDir, '.lock-embeddings', 'owner.json'),
      JSON.stringify({ pid: 2 ** 22 + 12345, startedAt: Date.now() }),
    );
    fs.mkdirSync(path.join(versionDir, '.staging-embeddings-crashed', 'node_modules'), { recursive: true });
    // A feature directory without a completion marker is not an install.
    fs.mkdirSync(path.join(versionDir, 'embeddings', 'node_modules', '@mastra', 'fastembed'), { recursive: true });
    expect(findInstalledFeature(target())).toBeUndefined();

    await installFeature(target(), { registry: registry.url });

    expect(findInstalledFeature(target())).toBe(getFeatureDir(target()));
    expect(leftovers()).toEqual([]);
    expect(fs.existsSync(path.join(versionDir, '.lock-embeddings'))).toBe(false);
  }, 60_000);

  it('offline: says the registry is unreachable, keeps the npm log, and leaves nothing half installed', async () => {
    const error = await installFeature(target(), { registry: await closedPortUrl() }).catch(e => e);

    expect(error).toBeInstanceOf(FeatureNotInstalledError);
    expect(error).toMatchObject({ feature: 'embeddings', reason: 'network' });
    expect(error.remedy).toContain('mastracode features install embeddings');
    expect(fs.existsSync(getFeatureDir(target()))).toBe(false);
    expect(leftovers()).toEqual([]);
    const failure = JSON.parse(fs.readFileSync(path.join(target().versionDir, '.failed-embeddings.json'), 'utf8'));
    expect(failure.reason).toBe('network');
    expect(fs.readFileSync(path.join(target().versionDir, '.failed-embeddings.log'), 'utf8')).toMatch(/ECONNREFUSED/);
  }, 60_000);

  it('a private mirror without the pinned version: says the version is missing', async () => {
    const error = await installFeature(target('9.9.9'), { registry: registry.url }).catch(e => e);

    expect(error).toMatchObject({ feature: 'embeddings', reason: 'not-found' });
    expect(fs.existsSync(getFeatureDir(target()))).toBe(false);
  }, 60_000);

  it('a later install succeeds after a failed one and clears the failure record', async () => {
    await installFeature(target(), { registry: await closedPortUrl() }).catch(() => {});
    await installFeature(target(), { registry: registry.url });

    expect(fs.existsSync(path.join(target().versionDir, '.failed-embeddings.json'))).toBe(false);
  }, 60_000);
});

describe('mastracode features', () => {
  function capture() {
    let text = '';
    return {
      write: (chunk: string) => (text += chunk),
      get text() {
        return text;
      },
    };
  }

  it('install embeddings: installs the version this build pins into MASTRACODE_FEATURES_DIR', async () => {
    process.env.MASTRACODE_FEATURES_DIR = root;
    process.env.npm_config_registry = registry.url;
    const stdout = capture();
    const stderr = capture();

    const code = await runFeaturesCommand(['install', 'embeddings'], { stdout, stderr });

    expect(stderr.text).toBe('');
    expect(code).toBe(0);
    expect(stdout.text).toMatch(/Installing local embeddings for memory recall \(about \d+ MB\)/);
    const [sdkVersion] = fs.readdirSync(root);
    const installed = path.join(root, sdkVersion!, 'embeddings', 'node_modules/@mastra/fastembed/package.json');
    expect(JSON.parse(fs.readFileSync(installed, 'utf8')).version).toBe(PINNED);
  }, 60_000);

  it('install with the registry unreachable: exits 1 and points at the npm log', async () => {
    process.env.MASTRACODE_FEATURES_DIR = root;
    process.env.npm_config_registry = await closedPortUrl();
    const stdout = capture();
    const stderr = capture();

    const code = await runFeaturesCommand(['install', '--all'], { stdout, stderr });

    expect(code).toBe(1);
    expect(stderr.text).toMatch(/Could not install embeddings: the npm registry could not be reached/);
    expect(stderr.text).toMatch(/npm output: .*\.failed-embeddings\.log/);
  }, 60_000);

  it('rejects an unknown feature name', async () => {
    const stderr = capture();
    expect(await runFeaturesCommand(['install', 'duckdb'], { stdout: capture(), stderr })).toBe(1);
    expect(stderr.text).toContain('Unknown feature "duckdb". Known features: embeddings');
  });
});
