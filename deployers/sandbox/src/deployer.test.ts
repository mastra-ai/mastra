import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SandboxDeployer } from './deployer';
import { FakeSandbox } from './fake-sandbox.mock';
import { MANIFEST_FILENAME } from './manifest';
import { SERVER_SCRIPT } from './shared';
import type { SandboxDeploymentManifest } from './types';

describe('SandboxDeployer', () => {
  let outputDirectory: string;
  let fetchMock: ReturnType<typeof vi.fn>;

  async function makeDeployer(
    sandbox: FakeSandbox,
    options: Partial<ConstructorParameters<typeof SandboxDeployer>[0]> = {},
  ) {
    const deployer = new SandboxDeployer({ sandbox, ...options });
    // Prebuilt output lives at <outputDirectory>/<outputDir>.
    const dir = join(outputDirectory, (deployer as unknown as { outputDir: string }).outputDir);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.mjs'), `console.log('server');`);
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'fake-app' }));
    return { deployer, dir };
  }

  beforeEach(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'mastra-out-'));
    fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Keep repo .env files out of the test.
    vi.stubEnv('MASTRA_SKIP_DOTENV', '1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('deploys and writes the manifest', async () => {
    const sandbox = new FakeSandbox({ info: { id: 'sbx-42', timeoutAt: new Date('2026-07-16T15:00:00Z') } });
    const { deployer, dir } = await makeDeployer(sandbox, { healthCheckTimeoutMs: 200 });

    await deployer.deploy(outputDirectory);

    const manifest = JSON.parse(await readFile(join(dir, MANIFEST_FILENAME), 'utf-8')) as SandboxDeploymentManifest;
    expect(manifest).toMatchObject({
      provider: 'fake',
      sandboxId: 'sbx-42',
      url: 'https://fake-sandbox.example',
      port: 4111,
      expiresAt: '2026-07-16T15:00:00.000Z',
    });
    expect(manifest.deployedAt).toBeTruthy();
  });

  it('injects configured env and MASTRA_STUDIO_PATH into the launch script', async () => {
    const sandbox = new FakeSandbox();
    const { deployer } = await makeDeployer(sandbox, {
      env: { OPENAI_API_KEY: 'sk-test' },
      healthCheckTimeoutMs: 200,
    });

    await deployer.deploy(outputDirectory);

    const script = sandbox.writtenFiles
      .flat()
      .find(f => f.path.endsWith(SERVER_SCRIPT))!
      .content.toString();
    expect(script).toContain(`export OPENAI_API_KEY='sk-test'`);
    expect(script).toContain(`export MASTRA_STUDIO_PATH='/home/fake/mastra-app/studio'`);
  });

  it('omits MASTRA_STUDIO_PATH when studio is disabled', async () => {
    const sandbox = new FakeSandbox();
    const { deployer } = await makeDeployer(sandbox, { studio: false, healthCheckTimeoutMs: 200 });

    await deployer.deploy(outputDirectory);

    const script = sandbox.writtenFiles
      .flat()
      .find(f => f.path.endsWith(SERVER_SCRIPT))!
      .content.toString();
    expect(script).not.toContain('MASTRA_STUDIO_PATH');
  });

  it('updates the Edge Config alias after a healthy deploy', async () => {
    const sandbox = new FakeSandbox();
    const { deployer } = await makeDeployer(sandbox, {
      alias: { edgeConfigId: 'ecfg_123', key: 'agent-url', token: 'vercel-token' },
      healthCheckTimeoutMs: 200,
    });

    await deployer.deploy(outputDirectory);

    const aliasCall = fetchMock.mock.calls.find(([url]) => String(url).includes('edge-config/ecfg_123/items'));
    expect(aliasCall).toBeDefined();
    const [, init] = aliasCall!;
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer vercel-token');
    expect(JSON.parse(init.body)).toEqual({
      items: [{ operation: 'upsert', key: 'agent-url', value: 'https://fake-sandbox.example' }],
    });
  });

  it('opts in to deploy-on-build so `mastra build` deploys after bundling', () => {
    const deployer = new SandboxDeployer({ sandbox: new FakeSandbox() });
    expect(deployer.deployOnBuild).toBe(true);
  });

  it('produces a long-running node server entry honoring the studio flag', () => {
    const withStudio = new SandboxDeployer({ sandbox: new FakeSandbox() });
    expect(withStudio['getEntry']()).toContain('studio: true');
    expect(withStudio['getEntry']()).toContain('createNodeServer');

    const withoutStudio = new SandboxDeployer({ sandbox: new FakeSandbox(), studio: false });
    expect(withoutStudio['getEntry']()).toContain('studio: false');
  });
});
