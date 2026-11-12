import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, beforeEach, afterEach } from 'vitest';
import { WORKSPACE_TOOLS } from '../../../../workspace/constants';
import { LocalFilesystem } from '../../../../workspace/filesystem';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: the opt-in apply_patch workspace tool.
 *
 * The tool must only be offered to the model when the workspace opts in, and a
 * model-issued multi-file patch must land on disk in one tool call.
 */
const APPLY_PATCH = WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH;

function requestToolNames(request: any): string[] {
  return (request?.body?.tools ?? []).map((t: any) => t?.function?.name ?? t?.name);
}

describeForAllEngines('AIMock scenario: workspace apply_patch', engine => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-apply-patch-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('does not offer apply_patch to the model unless the workspace opts in', async () => {
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { enabled: true },
    });

    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Hello',
      workspace,
      stopWhen: stepCountIs(1),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Hi.' });
      },
    });

    const names = requestToolNames(requests[0]);
    expect(names).toContain(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
    expect(names).not.toContain(APPLY_PATCH);
  });

  it('applies a model-issued multi-file patch when opted in', async () => {
    await fs.writeFile(path.join(tempDir, 'a.ts'), 'const a = 1;\n');
    await fs.writeFile(path.join(tempDir, 'old.txt'), 'bye\n');
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: { [APPLY_PATCH]: { enabled: true } },
    });

    const patch = [
      '*** Begin Patch',
      '*** Add File: src/b.ts',
      '+export const b = 2;',
      '*** Update File: a.ts',
      '@@',
      '-const a = 1;',
      '+const a = 42;',
      '*** Delete File: old.txt',
      '*** End Patch',
    ].join('\n');

    const { requests, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Apply the change.',
      workspace,
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_patch', name: APPLY_PATCH, arguments: { patch } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
      },
    });

    expect(requestToolNames(requests[0])).toContain(APPLY_PATCH);
    expect(requests).toHaveLength(2);

    expect(await fs.readFile(path.join(tempDir, 'src/b.ts'), 'utf8')).toBe('export const b = 2;\n');
    expect(await fs.readFile(path.join(tempDir, 'a.ts'), 'utf8')).toBe('const a = 42;\n');
    await expect(fs.stat(path.join(tempDir, 'old.txt'))).rejects.toThrow();

    const turn2 = JSON.stringify(requests[1]?.body?.messages ?? []);
    expect(turn2).toContain('A src/b.ts');
    expect(await output.text).toContain('Done.');
  });
});
