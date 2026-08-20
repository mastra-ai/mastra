import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestContext } from '@mastra/core/request-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';

const sdkRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..');
const piMcpAdapterRoot = path.dirname(fileURLToPath(import.meta.resolve('pi-mcp-adapter')));
let manager: PluginManager | undefined;
let tempDir: string | undefined;

const originalCwd = process.cwd();
const originalHome = process.env.HOME;

afterEach(async () => {
  await manager?.dispose();
  manager = undefined;
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('Pi ecosystem compatibility integration', () => {
  it('loads the pinned real MCP adapter and retires every owned contribution', async () => {
    const fixture = createManagerFixture('real-mcp');
    const corepackFixture = writeDependencyLinker(fixture.root, path.join(sdkRoot, 'node_modules'));
    const prepared = await manager!.preparePiPackage(piMcpAdapterRoot, 'global');
    const characterized = await manager!.characterizePiPackage(prepared, {
      trustCodeExecution: true,
      installScripts: 'deny',
      corepackCliPath: corepackFixture,
    });

    expect(characterized.compatibility).toMatchObject({
      targetApiVersion: '0.84.2',
      status: 'pi-compatible',
    });
    expect(characterized.compatibility.capabilities.map(capability => capability.name)).toEqual(
      expect.arrayContaining(['registerCommand', 'registerFlag', 'registerTool']),
    );

    await manager!.installPiPackage(characterized, { confirmEnable: true });
    const generation = manager!.getPiGenerations()[0]!;
    expect(generation.registrations.tools.has('mcp')).toBe(true);
    expect(generation.registrations.commands.size).toBeGreaterThan(0);
    expect(generation.registrations.flags.size).toBeGreaterThan(0);

    await manager!.setEnabled('pi-mcp-adapter', 'global', false);
    expect(generation.active).toBe(false);
    expect(manager!.getPiGenerations()).toEqual([]);
    expect(manager!.getPluginTools()).not.toHaveProperty('mcp');
    expect(manager!.getPiCommands()).toEqual([]);

    await manager!.uninstall('pi-mcp-adapter', 'global');
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
    expect(fs.existsSync(characterized.resolution.packageRoot)).toBe(false);
  }, 20_000);

  it('executes supported paths while attributing partial boundaries and cleaning disable/uninstall state', async () => {
    const fixture = createManagerFixture('partial-boundary');
    const sourceRoot = path.join(fixture.projectRoot, 'pi-ecosystem-boundary');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, 'package.json'),
      JSON.stringify({
        name: 'pi-ecosystem-boundary',
        version: '1.0.0',
        pi: { extensions: ['./index.ts'] },
        peerDependencies: { '@earendil-works/pi-coding-agent': '^0.84.2' },
      }),
    );
    fs.writeFileSync(
      path.join(sourceRoot, 'index.ts'),
      `import { Type } from 'typebox';
       export default function (pi) {
         pi.on('session_tree', () => {});
         pi.registerShortcut('ctrl+x', { handler: () => {} });
         pi.registerCommand('ecosystem-check', { handler: async () => 'ok' });
         pi.registerTool({
           name: 'ecosystem_echo',
           description: 'Ecosystem echo',
           parameters: Type.Object({ value: Type.String() }),
           execute: async (_id, params) => ({ content: [{ type: 'text', text: 'echo:' + params.value }] }),
         });
       }`,
    );

    const prepared = await manager!.preparePiPackage('./pi-ecosystem-boundary', 'project');
    const characterized = await manager!.characterizePiPackage(prepared, {
      trustCodeExecution: true,
      projectTrust: true,
      installScripts: 'deny',
    });
    expect(characterized.compatibility.status).toBe('pi-partial');
    expect(characterized.compatibility.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'event:session_tree', support: 'unsupported' }),
        expect.objectContaining({ name: 'registerShortcut', support: 'version-gated' }),
        expect.objectContaining({ name: 'registerTool', support: 'adapted' }),
      ]),
    );
    expect(characterized.compatibility.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ extensionId: 'pi-ecosystem-boundary:index.ts', capability: 'event:session_tree' }),
        expect.objectContaining({ extensionId: 'pi-ecosystem-boundary:index.ts', capability: 'registerShortcut' }),
      ]),
    );

    await manager!.installPiPackage(characterized, { confirmEnable: true });
    await expect(executeTool(manager!.getPluginTools().ecosystem_echo, { value: 'verified' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'echo:verified' }],
      isError: false,
    });
    expect(manager!.getPiCommands().map(command => command.name)).toContain('ecosystem-check');

    await manager!.setEnabled('pi-ecosystem-boundary', 'project', false);
    expect(manager!.getPluginTools()).not.toHaveProperty('ecosystem_echo');
    expect(manager!.getPiCommands()).toEqual([]);
    expect(manager!.getPiGenerations()).toEqual([]);

    await manager!.uninstall('pi-ecosystem-boundary', 'project');
    expect(fs.existsSync(characterized.resolution.sourceRoot)).toBe(false);
    expect(fs.existsSync(characterized.resolution.packageRoot)).toBe(false);
  });
});

function createManagerFixture(name: string): { root: string; projectRoot: string; homeDir: string } {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `mc-pi-ecosystem-${name}-`));
  const projectRoot = path.join(tempDir, 'project');
  const homeDir = path.join(tempDir, 'home');
  fs.mkdirSync(projectRoot, { recursive: true });
  process.chdir(projectRoot);
  process.env.HOME = homeDir;
  manager = new PluginManager({ projectRoot, homeDir });
  return { root: tempDir, projectRoot, homeDir };
}

function writeDependencyLinker(root: string, nodeModules: string): string {
  const entry = path.join(root, 'corepack-fixture.mjs');
  fs.writeFileSync(
    entry,
    `#!/usr/bin/env node\nimport fs from 'node:fs';\nimport path from 'node:path';\nfs.symlinkSync(${JSON.stringify(nodeModules)}, path.join(process.cwd(), 'node_modules'), 'dir');\n`,
    { mode: 0o755 },
  );
  return entry;
}

async function executeTool(tool: unknown, input: unknown): Promise<unknown> {
  if (!tool || typeof tool !== 'object' || !('execute' in tool) || typeof tool.execute !== 'function') {
    throw new Error('Missing executable ecosystem tool');
  }
  return tool.execute(input, {
    requestContext: new RequestContext(),
    observe: vi.fn(),
  } as unknown as ToolExecutionContext);
}
