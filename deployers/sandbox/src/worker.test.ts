import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { FakeSandbox, makeBuildDir } from './fake-sandbox.mock.js';
import { deployWorkerToSandbox } from './worker.js';

describe('deployWorkerToSandbox', () => {
  it('deploys a trusted command without networking or process handles', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const dir = await makeBuildDir(tmpdir());

    const deployment = await deployWorkerToSandbox({
      sandbox,
      dir,
      command: 'node',
      args: ['index.mjs', '--request', 'value with spaces'],
      workingDirectory: '.',
      env: { SECRET: "doesn't leak" },
    });

    expect(deployment.sandboxId).toBe('fake-info-id');
    expect(await deployment.status()).toEqual({ state: 'running' });
    expect(sandbox.spawned).toEqual([]);
    expect(
      sandbox.commands.some(command => command.includes('nohup sh') && command.includes('.mastra-worker.sh')),
    ).toBe(true);

    const launchScript = sandbox.writtenFiles.flat().find(file => file.path.endsWith('.mastra-worker.sh'));
    expect(launchScript).toBeDefined();
    const content = Buffer.isBuffer(launchScript!.content)
      ? launchScript!.content.toString()
      : String(launchScript!.content);
    expect(content).toContain("'node' 'index.mjs' '--request' 'value with spaces'");
    expect(content).toContain("SECRET='doesn'\\''t leak'");
  });

  it('reports completed one-shot commands and exposes output', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false, workerStatus: 'exited 7', serverLog: 'worker output' });
    const dir = await makeBuildDir(tmpdir());

    const deployment = await deployWorkerToSandbox({
      sandbox,
      dir,
      mode: 'job',
      command: 'node',
      args: ['index.mjs'],
    });

    expect(await deployment.status()).toEqual({ state: 'exited', exitCode: 7 });
    expect(await deployment.logs()).toBe('worker output');
    await expect(deployment.relaunch()).rejects.toThrow('Cannot relaunch a terminal job');
  });

  it('cancels with graceful then forced termination and avoids duplicate relaunch', async () => {
    const sandbox = new FakeSandbox({ withNetworking: false });
    const dir = await makeBuildDir(tmpdir());
    const deployment = await deployWorkerToSandbox({ sandbox, dir, command: 'node', args: ['index.mjs'] });
    const launchesBefore = sandbox.commands.filter(command => command.includes('nohup sh')).length;

    await deployment.relaunch();
    await deployment.cancel();

    expect(sandbox.commands.filter(command => command.includes('nohup sh'))).toHaveLength(launchesBefore);
    expect(sandbox.commands.at(-1)).toContain('kill -9');
    expect(sandbox.commands.at(-1)).toContain('cancelled');
  });
});
