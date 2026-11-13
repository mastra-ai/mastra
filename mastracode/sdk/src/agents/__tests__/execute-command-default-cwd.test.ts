import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalSandbox, Workspace, createWorkspaceTools } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMastraCodeWorkspaceTools } from '../tool-availability';

// A Factory session's checkout sits one level under the sandbox's own default
// cwd, while the prompt names the checkout as the working directory.
describe('execute_command without a cwd', () => {
  let root: string;
  let repo: string;

  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'mc-cwd-')));
    repo = join(root, 'repo');
    await mkdir(join(repo, 'sub'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function runPwd(input: Record<string, unknown>, projectPath: string | undefined) {
    const workspace = new Workspace({
      sandbox: new LocalSandbox({ workingDirectory: root }),
      tools: createMastraCodeWorkspaceTools(),
    });
    const tools: Record<string, any> = await createWorkspaceTools(workspace);
    const requestContext = new Map<string, unknown>([
      ['controller', { session: { state: { get: () => (projectPath ? { projectPath } : {}) } } }],
    ]);
    const output = await tools['execute_command'].execute(
      { command: 'pwd', description: 'Print the working directory', ...input },
      { workspace, requestContext },
    );
    return String(output).trim();
  }

  it('runs from the project path rather than the sandbox default', async () => {
    expect(await runPwd({}, repo)).toBe(repo);
    expect(await runPwd({ cwd: null }, repo)).toBe(repo);
  });

  it('keeps an explicit cwd', async () => {
    expect(await runPwd({ cwd: join(repo, 'sub') }, repo)).toBe(join(repo, 'sub'));
  });

  it('falls back to the sandbox default when there is no project path', async () => {
    expect(await runPwd({}, undefined)).toBe(root);
  });
});
