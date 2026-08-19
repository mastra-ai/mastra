import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RequestContext } from '@mastra/core/request-context';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from '../../manager.js';
import { savePluginRegistry } from '../../registry.js';

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
  it('loads a Pi fixture as a runnable owned plugin tool with progress and renderer fallback', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-tool-integration-'));
    const projectRoot = path.join(tempDir, 'project');
    const registryPath = path.join(projectRoot, '.mastracode/plugins/plugins.json');
    savePluginRegistry(registryPath, {
      plugins: {
        'fixture.pi-tool': {
          enabled: true,
          source: 'local',
          compatibility: 'pi',
          specifier: fixtureRoot,
          path: fixtureRoot,
          entry: 'tool-extension.ts',
        },
      },
    });
    manager = new PluginManager({ projectRoot, homeDir: path.join(tempDir, 'home') });

    const loaded = await manager.reload();
    const plugin = loaded.find(candidate => candidate.id === 'fixture.pi-tool');
    expect(plugin).toMatchObject({ status: 'active', toolNames: ['pi_fixture_echo'] });
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
