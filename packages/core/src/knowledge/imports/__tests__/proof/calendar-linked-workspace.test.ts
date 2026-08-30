import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];
const adapter = process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../../');
const creator = join(here, 'create-linked-workspace.ts');

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

describe(`calendar importer linked-workspace proof (${adapter})`, () => {
  it('converges replay and proves trigger and activity invariants through public packages', async () => {
    const directory = await mkdtemp(join(tmpdir(), `knowledge-calendar-${adapter}-`));
    temporaryDirectories.push(directory);
    const workspace = join(directory, 'workspace');
    const output = join(directory, 'output');
    await run('pnpm', ['exec', 'tsx', creator, '--out', workspace], root);
    await run('pnpm', ['install', '--offline'], workspace);
    const execution = await run('pnpm', ['calendar', '--', '--scenario', 'all', '--out', output], workspace, {
      KNOWLEDGE_ADAPTER: adapter,
    });
    const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));

    expect(execution.stdout).toContain(`PROOF: GREEN — calendar importer passed on ${adapter}`);
    expect(result).toMatchObject({
      adapter,
      source: 'google-calendar:test-user@example.com',
      address: 'event:evt-1',
      failedRun: { status: 'failed', cursorCommitted: false },
      replayRun: { status: 'succeeded', cursor: 'sync-1' },
      updateRun: {
        status: 'succeeded',
        name: 'Architecture review updated',
        revision: 2,
        cursor: 'sync-2',
      },
      removalRun: { status: 'succeeded', cursor: 'sync-3' },
      omittedEntryPreserved: true,
      explicitRemovalApplied: true,
      unauthorizedBindingRejected: true,
      cronOverlapStatus: 'skipped',
      sameBindingWebhookFifo: true,
      differentBindingConcurrent: true,
      activityLinkedToRuns: true,
    });
    expect(result.updateRun.nodeId).toBe(result.stableNodeId);
    expect(result.updateRun.recordIds).toHaveLength(1);
    expect(result.removalRun.removedNodeId).not.toBe(result.stableNodeId);
    expect(result.executionOrder.indexOf('end:cron-primary')).toBeLessThan(
      result.executionOrder.indexOf('start:webhook-primary'),
    );
  }, 120_000);
});
