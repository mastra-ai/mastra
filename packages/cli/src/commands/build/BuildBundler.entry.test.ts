import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BuildBundler } from './BuildBundler';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/**
 * Runs the generated server entry with Node against stub `#mastra`/`#server`/`#tools` modules that log every call.
 * `failAt` makes that call reject.
 */
async function runEntry(failAt?: 'createNodeServer' | 'storage.init') {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-build-entry-'));
  tempDirs.push(dir);

  const entry = (new BuildBundler() as unknown as { getEntry(): string })
    .getEntry()
    .replace("from '@mastra/core/evals/scoreTraces'", "from './stubs.mjs'")
    .replace("from '#mastra'", "from './stubs.mjs'")
    .replace("from '#server'", "from './stubs.mjs'")
    .replace("from '#tools'", "from './stubs.mjs'");

  await writeFile(join(dir, 'index.mjs'), entry);
  await writeFile(
    join(dir, 'stubs.mjs'),
    `const failAt = ${JSON.stringify(failAt ?? null)};
    const step = name => {
      console.log(name);
      if (name === failAt) return Promise.reject(new Error(name + ' failed'));
      return Promise.resolve();
    };
    export const scoreTracesWorkflow = {};
    export const tools = {};
    export const getToolExports = tools => tools;
    export const createNodeServer = () => step('createNodeServer');
    export const mastra = {
      recoveryConfig: { durableAgents: 'auto' },
      getStorage: () => ({ init: () => step('storage.init') }),
      __registerInternalWorkflow: () => console.log('registerInternalWorkflow'),
      restartAllActiveWorkflowRuns: () => step('restartAllActiveWorkflowRuns'),
      recoverAllDurableAgents: () => step('recoverAllDurableAgents'),
    };
    console.log('module evaluated');`,
  );
  await writeFile(join(dir, 'after.mjs'), `import './index.mjs';\nconsole.log('entry evaluated');\n`);

  // Importing the entry from another module shows whether its evaluation waits for the server to start.
  const child = spawn(process.execPath, ['after.mjs'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf-8').on('data', chunk => (stdout += chunk));
  child.stderr.setEncoding('utf-8').on('data', chunk => (stderr += chunk));
  const [code] = await once(child, 'exit');

  return { code, steps: stdout.trim().split('\n'), stderr };
}

describe('BuildBundler server entry', () => {
  it('starts the server, then initializes storage and runs recoveries, without top-level await', async () => {
    const { code, steps, stderr } = await runEntry();

    expect(stderr).toBe('');
    expect(code).toBe(0);
    expect(steps).toEqual([
      'module evaluated',
      'createNodeServer',
      // Startup runs in an async function, so the module finishes evaluating right away.
      'entry evaluated',
      'storage.init',
      'registerInternalWorkflow',
      'restartAllActiveWorkflowRuns',
      'recoverAllDurableAgents',
    ]);
  });

  it.each(['createNodeServer', 'storage.init'] as const)(
    'exits with code 1 and prints the error when %s fails',
    async failAt => {
      const { code, steps, stderr } = await runEntry(failAt);

      expect(code).toBe(1);
      expect(stderr).toContain(`Error: ${failAt} failed`);
      // Nothing after the failed step runs.
      expect(steps).toContain(failAt);
      expect(steps.slice(steps.indexOf(failAt) + 1).filter(step => step !== 'entry evaluated')).toEqual([]);
    },
  );
});
