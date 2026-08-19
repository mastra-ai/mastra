import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RequestContext } from '@mastra/core/request-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';
import { savePluginRegistry } from '../../registry.js';
import { createTrustedPiPackageRecord } from './trusted-package.js';

const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));
let tempDir: string | undefined;
let manager: PluginManager | undefined;

afterEach(async () => {
  await manager?.dispose();
  manager = undefined;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('Pi tool adapter integration', () => {
  it('rejects uncharacterized Pi Package entries before executing module code', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-trust-integration-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/trust-fixture');
    const markerPath = path.join(tempDir, 'executed');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'index.ts'), 'export default function () {}');
    fs.writeFileSync(
      path.join(packageRoot, 'uncharacterized.ts'),
      `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(markerPath)}, 'executed'); export default function () {}`,
    );
    const record = createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project');
    record.entry = 'uncharacterized.ts';
    record.entries = ['uncharacterized.ts'];
    savePluginRegistry(path.join(pluginRoot, 'plugins.json'), { plugins: { 'fixture.untrusted-entry': record } });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();

    expect(loaded).toContainEqual(
      expect.objectContaining({
        id: 'fixture.untrusted-entry',
        status: 'load failed',
        error: expect.stringContaining('extension entries do not match'),
      }),
    );
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('rejects materialized package roots replaced by symlinks before executing module code', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-symlink-integration-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/symlink-fixture');
    const outsideRoot = path.join(tempDir, 'outside-package');
    const markerPath = path.join(tempDir, 'executed');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'index.ts'),
      `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(markerPath)}, 'executed'); export default function () {}`,
    );
    const record = createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project');
    fs.renameSync(packageRoot, outsideRoot);
    fs.symlinkSync(outsideRoot, packageRoot);
    savePluginRegistry(path.join(pluginRoot, 'plugins.json'), { plugins: { 'fixture.symlink': record } });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();

    expect(loaded).toContainEqual(
      expect.objectContaining({
        id: 'fixture.symlink',
        status: 'load failed',
        error: expect.stringContaining('path cannot contain symbolic links'),
      }),
    );
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('rejects modified materialized package contents before executing module code', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-integrity-integration-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/integrity-fixture');
    const markerPath = path.join(tempDir, 'executed');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'index.ts'), 'export default function () {}');
    const record = createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project');
    fs.writeFileSync(
      path.join(packageRoot, 'index.ts'),
      `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(markerPath)}, 'executed'); export default function () {}`,
    );
    savePluginRegistry(path.join(pluginRoot, 'plugins.json'), { plugins: { 'fixture.modified': record } });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();

    expect(loaded).toContainEqual(
      expect.objectContaining({
        id: 'fixture.modified',
        status: 'load failed',
        error: expect.stringContaining('materialized integrity mismatch'),
      }),
    );
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('rejects modified installed dependencies before executing module code', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-dependency-integrity-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/dependency-fixture');
    const dependencyRoot = path.join(packageRoot, 'node_modules/dependency');
    const markerPath = path.join(tempDir, 'executed');
    fs.mkdirSync(dependencyRoot, { recursive: true });
    fs.writeFileSync(path.join(dependencyRoot, 'index.js'), 'export const value = 1;');
    fs.writeFileSync(
      path.join(packageRoot, 'index.ts'),
      `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(markerPath)}, 'executed'); export default function () {}`,
    );
    const record = createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project');
    fs.writeFileSync(path.join(dependencyRoot, 'index.js'), 'export const value = 2;');
    savePluginRegistry(path.join(pluginRoot, 'plugins.json'), { plugins: { 'fixture.dependency': record } });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();

    expect(loaded).toContainEqual(
      expect.objectContaining({
        id: 'fixture.dependency',
        status: 'load failed',
        error: expect.stringContaining('materialized integrity mismatch'),
      }),
    );
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('rejects retargeted installed dependency symlinks before executing module code', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-dependency-link-integrity-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/dependency-link-fixture');
    const nodeModulesRoot = path.join(packageRoot, 'node_modules');
    const firstTarget = path.join(nodeModulesRoot, '.store/dependency-a');
    const secondTarget = path.join(nodeModulesRoot, '.store/dependency-b');
    const dependencyLink = path.join(nodeModulesRoot, 'dependency');
    const markerPath = path.join(tempDir, 'executed');
    fs.mkdirSync(firstTarget, { recursive: true });
    fs.mkdirSync(secondTarget, { recursive: true });
    fs.writeFileSync(path.join(firstTarget, 'index.js'), 'export const value = 1;');
    fs.writeFileSync(path.join(secondTarget, 'index.js'), 'export const value = 2;');
    fs.symlinkSync(path.relative(nodeModulesRoot, firstTarget), dependencyLink);
    fs.writeFileSync(
      path.join(packageRoot, 'index.ts'),
      `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(markerPath)}, 'executed'); export default function () {}`,
    );
    const record = createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project');
    fs.unlinkSync(dependencyLink);
    fs.symlinkSync(path.relative(nodeModulesRoot, secondTarget), dependencyLink);
    savePluginRegistry(path.join(pluginRoot, 'plugins.json'), { plugins: { 'fixture.dependency-link': record } });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();

    expect(loaded).toContainEqual(
      expect.objectContaining({
        id: 'fixture.dependency-link',
        status: 'load failed',
        error: expect.stringContaining('materialized integrity mismatch'),
      }),
    );
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('loads a Pi fixture as a runnable owned plugin tool with progress and renderer fallback', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-tool-integration-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginRoot = path.join(projectRoot, '.mastracode/plugins');
    const packageRoot = path.join(pluginRoot, 'sources/pi-packages/local/tool-fixture');
    fs.cpSync(fixtureRoot, packageRoot, { recursive: true });
    const registryPath = path.join(pluginRoot, 'plugins.json');
    savePluginRegistry(registryPath, {
      plugins: {
        'fixture.pi-tool': createTrustedPiPackageRecord(packageRoot, pluginRoot, 'project', 'tool-extension.ts'),
      },
    });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();
    const plugin = loaded.find(candidate => candidate.id === 'fixture.pi-tool');
    expect(plugin).toMatchObject({ status: 'active', toolNames: ['pi_fixture_echo'] });
    expect(manager.getPluginProcessors()).toMatchObject({
      input: [{ pluginId: 'fixture.pi-tool', value: { id: expect.stringContaining(':input') } }],
      output: [{ pluginId: 'fixture.pi-tool', value: { id: expect.stringContaining(':output') } }],
    });
    const tool = manager.getPluginTools().pi_fixture_echo;
    if (!tool || typeof tool.execute !== 'function') throw new Error('Pi fixture tool was not executable');
    const chunks: unknown[] = [];
    const outputWriter = vi.fn(async chunk => chunks.push(chunk));

    await expect(
      tool.execute({ text: 'integration' }, {
        requestContext: new RequestContext(),
        observe: vi.fn(),
        agent: { toolCallId: 'integration-call', outputWriter } as unknown as ToolExecutionContext['agent'],
      } as unknown as ToolExecutionContext),
    ).resolves.toMatchObject({
      content: [{ type: 'text', text: 'fixture result: integration' }],
      details: { fixture: true },
      isError: false,
    });
    expect(chunks).toEqual([
      {
        type: 'data-mastracode-tool-progress',
        data: {
          toolCallId: 'integration-call',
          progress: { status: 'running', detail: 'fixture progress' },
        },
        transient: true,
      },
    ]);

    const renderConfig = manager.getToolRenderConfig('pi_fixture_echo');
    expect(renderConfig?.type).toBe('pi-text');
    if (renderConfig?.type !== 'pi-text') throw new Error('Pi fixture renderer was not adapted');
    expect(renderConfig.renderResult({ content: [] })).toBe('{"content":[]}');
    expect(plugin?.piGeneration?.compatibility.diagnostics).toEqual([
      expect.objectContaining({
        extensionId: 'fixture.pi-tool:tool-extension.ts',
        message: expect.stringContaining('unsupported result renderer node'),
      }),
    ]);
  });
});
