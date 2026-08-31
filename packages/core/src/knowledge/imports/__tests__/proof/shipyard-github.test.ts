import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../../');
const creator = join(here, 'create-linked-workspace.ts');
const enabled = process.env.RUN_SHIPYARD_GITHUB_PROOF === '1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return exec(command, args, {
    cwd,
    env: { ...process.env, NO_COLOR: '1', ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('Shipyard GitHub linked-workspace proof', () => {
  it.skipIf(!enabled)(
    'imports a real GitHub window and distills a merged PR with a real provider',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'knowledge-shipyard-github-'));
      temporaryDirectories.push(directory);
      const workspace = join(directory, 'workspace');
      const output = join(directory, 'output');
      await run('pnpm', ['exec', 'tsx', creator, '--out', workspace], root);
      await run('pnpm', ['install', '--offline'], workspace);
      const openaiKey = process.env.SHIPYARD_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
      const mastraKey = process.env.MASTRA_API_KEY;
      if (!openaiKey && !mastraKey) {
        throw new Error('SHIPYARD_OPENAI_API_KEY, OPENAI_API_KEY, or MASTRA_API_KEY is required for the live proof');
      }
      const execution = await run('pnpm', ['github', '--', '--out', output], workspace, {
        ...(openaiKey ? { OPENAI_API_KEY: openaiKey } : {}),
        ...(mastraKey ? { MASTRA_API_KEY: mastraKey } : {}),
      });
      const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));

      expect(execution.stdout).toContain('PROOF: GREEN — real GitHub source and agentic distillation passed');
      expect(result).toMatchObject({
        repository: 'mastra-ai/mastra',
        staticImport: {
          interruptedStatus: 'failed',
          replayStatus: 'succeeded',
          issueNodeCount: 1,
          pullRequestNodeCount: 1,
          crossLinksVerified: true,
        },
        agenticImport: { status: 'succeeded' },
      });
      expect(result.staticImport.sourceNodeCount).toBe(result.sourceWindow.changedFiles);
      expect(result.staticImport.recordCount).toBe(result.sourceWindow.changedFiles + 2);
      expect(result.staticImport.stableNodeId).toMatch(uuid);
      expect(result.staticImport.scopeId).toMatch(uuid);
      expect(result.agenticImport.destinationScopeId).toMatch(uuid);
      expect(result.agenticImport.decisionNodeId).toMatch(uuid);
      expect(result.agenticImport.recordId).toMatch(uuid);
      expect(result.staticImport.checkpoint).toBe(result.sourceWindow.mergeCommitSha);
      expect(result.agenticImport.provenance).toBe(`[[pr:${result.sourceWindow.pullRequest}]]`);
    },
    240_000,
  );
});
