import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { OwnedResources } from '../helpers/process-cleanup.js';
import { parseProtocolOutput } from '../helpers/run-protocol.js';

describe('experiment worker harness', () => {
  test('rejects application output mixed into protocol stdout', () => {
    expect(() => parseProtocolOutput('{"type":"accepted","sequence":0}\ncustomer log\n')).toThrow(
      'Non-protocol stdout at line 2',
    );
  });

  test('terminates owned descendant process groups and removes owned paths', async () => {
    const resources = new OwnedResources();
    const root = resources.trackPath(await mkdtemp(join(tmpdir(), 'experiment-worker-cleanup-test-')));
    await mkdir(join(root, 'nested'));
    const child = resources.spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], root);
    await new Promise(resolve => setTimeout(resolve, 100));

    const evidence = await resources.cleanup();

    expect(evidence.remainingPaths).toEqual([]);
    expect(evidence.processes).toEqual([{ pid: child.pid, exited: true, escalated: false }]);
  });
});
