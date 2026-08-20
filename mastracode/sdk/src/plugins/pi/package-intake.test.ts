import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());
vi.mock('execa', () => ({ execa: execaMock }));

import { PluginManager } from '../manager.js';
import { characterizePiPackage, createPiPackageRecord, preparePiPackage } from './package-intake.js';

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function makeFixture(options: { lifecycleScript?: boolean; packageManager?: string; piApiRange?: string } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-intake-'));
  tempDir = root;
  const projectRoot = path.join(root, 'project');
  const packageRoot = path.join(projectRoot, 'fixture');
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({
      name: 'pi-intake-fixture',
      version: '1.0.0',
      ...(options.packageManager ? { packageManager: options.packageManager } : {}),
      pi: { extensions: ['./index.js'] },
      peerDependencies: { '@earendil-works/pi-agent-core': options.piApiRange ?? '^0.84.0' },
      ...(options.lifecycleScript ? { scripts: { postinstall: 'node postinstall.js' } } : {}),
    }),
  );
  const factoryMarker = path.join(root, 'factory-executed');
  fs.writeFileSync(
    path.join(packageRoot, 'index.js'),
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(factoryMarker)}, 'executed'); export default api => api.registerTool({ name: 'fixture_tool', description: 'fixture', execute: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });`,
  );
  return { root, projectRoot, homeDir: path.join(root, 'home'), factoryMarker };
}

describe('Pi Package intake trust boundary', () => {
  it('requires code-execution and project trust before install or factory execution', async () => {
    const fixture = makeFixture({ lifecycleScript: true });
    const prepared = await preparePiPackage('./fixture', 'project', fixture);

    await expect(
      characterizePiPackage(prepared, { trustCodeExecution: false, installScripts: 'deny' } as never),
    ).rejects.toThrow('code-execution trust');
    await expect(characterizePiPackage(prepared, { trustCodeExecution: true, installScripts: 'deny' })).rejects.toThrow(
      'project trust',
    );
    expect(execaMock).not.toHaveBeenCalled();
    expect(fs.existsSync(fixture.factoryMarker)).toBe(false);
  });

  it('marks unknown Pi API ranges as version-gated during characterization', async () => {
    const fixture = makeFixture({ piApiRange: '^1.0.0' });
    const prepared = await preparePiPackage('./fixture', 'project', fixture);

    const characterized = await characterizePiPackage(prepared, {
      trustCodeExecution: true,
      projectTrust: true,
      installScripts: 'deny',
    });

    expect(characterized.compatibility.status).toBe('pi-partial');
    expect(characterized.compatibility.capabilities).toContainEqual(
      expect.objectContaining({ name: 'pi-api-version', support: 'version-gated' }),
    );
  });

  it('runs lifecycle scripts only when the trusted caller explicitly allows them', async () => {
    const fixture = makeFixture({ lifecycleScript: true });
    execaMock.mockResolvedValue({ stdout: '' });
    const prepared = await preparePiPackage('./fixture', 'project', fixture);

    const characterized = await characterizePiPackage(prepared, {
      trustCodeExecution: true,
      projectTrust: true,
      installScripts: 'allow',
    });

    const installArgs = execaMock.mock.calls[0]?.[1] as string[];
    expect(installArgs).not.toContain('--ignore-scripts');
    expect(characterized.trust.installScripts).toBe('allow');
  });

  it('uses a package-pinned pnpm version for dependency installation', async () => {
    const fixture = makeFixture({ lifecycleScript: true, packageManager: 'pnpm@11.1.2' });
    execaMock.mockResolvedValue({ stdout: '' });
    const prepared = await preparePiPackage('./fixture', 'project', fixture);

    await characterizePiPackage(prepared, {
      trustCodeExecution: true,
      projectTrust: true,
      installScripts: 'deny',
    });

    expect(execaMock).toHaveBeenCalledWith(
      'corepack',
      expect.arrayContaining(['pnpm@11.1.2', 'install', '--ignore-scripts']),
      expect.any(Object),
    );
  });

  it('requires explicit trust through the non-interactive manager API and cleans cancelled candidates', async () => {
    const fixture = makeFixture();
    const manager = new PluginManager(fixture);
    try {
      const prepared = await manager.preparePiPackage('./fixture', 'project');
      await expect(
        manager.characterizePiPackage(prepared, { trustCodeExecution: false, installScripts: 'deny' } as never),
      ).rejects.toThrow('code-execution trust');
      expect(fs.existsSync(fixture.factoryMarker)).toBe(false);
      expect(fs.existsSync(prepared.resolution.sourceRoot)).toBe(true);

      manager.discardPiPackageCandidate(prepared);
      expect(fs.existsSync(prepared.resolution.sourceRoot)).toBe(false);
    } finally {
      await manager.dispose();
    }
  });

  it('characterizes only after trust and creates an owned record after applying the script policy', async () => {
    const fixture = makeFixture({ lifecycleScript: true });
    execaMock.mockResolvedValue({ stdout: '' });
    const prepared = await preparePiPackage('./fixture', 'project', fixture);

    const characterized = await characterizePiPackage(prepared, {
      trustCodeExecution: true,
      projectTrust: true,
      installScripts: 'deny',
    });

    expect(execaMock).toHaveBeenCalledWith(
      'corepack',
      expect.arrayContaining(['pnpm@10.24.0', 'install', '--ignore-scripts']),
      expect.objectContaining({ cwd: characterized.resolution.packageRoot }),
    );
    expect(fs.existsSync(fixture.factoryMarker)).toBe(true);
    expect(characterized.compatibility.status).toBe('pi-compatible');
    expect(characterized.compatibility.capabilities.map(capability => capability.name)).toContain('registerTool');
    const record = createPiPackageRecord(characterized, fixture);
    expect(record).toMatchObject({
      enabled: true,
      source: 'pi-package',
      compatibility: 'pi',
      specifier: './fixture',
      entry: 'index.js',
      entries: ['index.js'],
      version: '1.0.0',
      piPackage: {
        resolution: {
          sourceType: 'local',
          integrity: expect.stringMatching(/^sha512-/),
          contentIntegrity: expect.stringMatching(/^sha512-/),
          materializedIntegrity: expect.stringMatching(/^sha512-/),
        },
        targetApiVersion: '0.84.2',
        observedApiVersion: '^0.84.0',
        trust: { codeExecution: 'trusted', project: 'trusted', installScripts: 'deny' },
      },
    });
  });
});
