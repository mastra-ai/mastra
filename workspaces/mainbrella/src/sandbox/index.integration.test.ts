import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import posix from 'node:path/posix';

import { Workspace } from '@mastra/core/workspace';
import { expect, it } from 'vitest';

import { MainbrellaFilesystem } from '../filesystem';
import { MainbrellaSandbox } from './index';

// Explicit opt-in: this suite uses one start and only stops its own generation.
it.skipIf(process.env.MAINBRELLA_RUN_INTEGRATION !== 'true')(
  'verifies a Mainbrella workspace against the selected API',
  async () => {
    const creationKey = randomUUID();
    const basePath = `/workspace/mastra-${randomUUID()}`;
    const sandbox = new MainbrellaSandbox({
      catalogId: process.env.MAINBRELLA_CATALOG_ID ?? 'node',
      size: 'lite',
      creationKey,
      workingDirectory: basePath,
    });
    const filesystem = new MainbrellaFilesystem({ sandbox, basePath });
    const workspace = new Workspace({ sandbox, filesystem });
    const stateDirectory = await mkdtemp(posix.join(tmpdir(), 'mastra-mainbrella-'));
    const recoveryPath = posix.join(stateDirectory, 'recovery.json');
    const saveRecovery = async (cleanup: string) =>
      writeFile(
        recoveryPath,
        JSON.stringify({
          apiUrl: sandbox.client.baseUrl,
          creationKey,
          creationBody: { catalogId: process.env.MAINBRELLA_CATALOG_ID ?? 'node', size: 'lite' },
          container: sandbox.container,
          cleanup,
        }),
        { mode: 0o600 },
      );
    await saveRecovery('pending');
    const report = {
      foreground: false,
      files: false,
      managed: false,
      reconnect: false,
      stdin: false,
      cancellation: false,
      cleanup: 'pending',
    };
    try {
      await sandbox.start();
      await saveRecovery('pending');
      await workspace.init();

      const foreground = await sandbox.mainbrella.commands.run('echo "hello from mainbrella"');
      expect(foreground).toMatchObject({
        stdout: 'hello from mainbrella\n',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
      });
      report.foreground = true;

      const probe = Buffer.from(Array.from({ length: 8192 }, (_, index) => index % 256));
      await filesystem.writeFile('input/probe.bin', probe);
      expect(await filesystem.readFile('input/probe.bin')).toEqual(probe);
      await filesystem.appendFile('notes.txt', 'first\n');
      await filesystem.appendFile('notes.txt', 'second\n');
      expect(await filesystem.readFile('notes.txt', { encoding: 'utf8' })).toBe('first\nsecond\n');
      expect((await filesystem.readdir('input'))[0]?.name).toBe('probe.bin');
      expect((await filesystem.stat('input/probe.bin')).size).toBe(probe.length);
      await filesystem.copyFile('input/probe.bin', 'copy.bin');
      await filesystem.moveFile('copy.bin', 'moved.bin');
      expect(await filesystem.readFile('moved.bin')).toEqual(probe);
      await filesystem.deleteFile('moved.bin');
      report.files = true;

      const stdout: string[] = [];
      const result = await sandbox.executeCommand('printf', ['%s', 'hello from mainbrella'], {
        onStdout: data => stdout.push(data),
      });
      expect(result).toMatchObject({ success: true, stdout: 'hello from mainbrella', exitCode: 0 });
      expect(stdout.join('')).toBe(result.stdout);
      const shell = await sandbox.executeCommand('printf "%s|%s" "$PROBE" "$PWD"', [], { env: { PROBE: 'env works' } });
      expect(shell.stdout).toBe(`env works|${basePath}`);
      report.managed = true;

      const job = await sandbox.mainbrella.commands.start('printf first; sleep 1; printf second', { timeoutMs: 10000 });
      let streamed = '';
      for await (const event of job.events()) {
        if (event.type === 'stdout') {
          streamed += event.data;
          break;
        }
      }
      for await (const event of job.events()) if (event.type === 'stdout') streamed += event.data;
      expect(streamed).toBe('firstsecond');
      expect((await job.get()).exitCode).toBe(0);
      report.reconnect = true;

      const piped = await sandbox.processes.spawn('cat', { timeout: 10000 });
      await piped.sendStdin('stdin works\n');
      await piped.closeStdin();
      expect((await piped.wait()).stdout).toBe('stdin works\n');
      report.stdin = true;

      const sleeping = await sandbox.processes.spawn('sleep 30', { timeout: 60000, stdinMode: 'ignore' });
      expect((await sandbox.processes.list()).some(item => item.pid === sleeping.pid)).toBe(true);
      expect(await sleeping.kill()).toBe(true);
      expect(await sleeping.wait()).toMatchObject({ success: false, killed: true, exitCode: 137 });
      report.cancellation = true;

      const connected = new MainbrellaSandbox({ container: sandbox.container });
      expect(await connected.start()).toEqual({ outcome: 'connected' });
      expect(await connected.isReady()).toBe(true);
      expect((await connected.getInfo()).timeoutAt).toBeInstanceOf(Date);
    } finally {
      // Preserve identity before destroy clears it, even when an assertion fails.
      await saveRecovery('pending');
      await sandbox._destroy();
      await filesystem._destroy();
      report.cleanup = 'completed';
      await writeFile(recoveryPath, JSON.stringify({ apiUrl: sandbox.client.baseUrl, creationKey, ...report }), {
        mode: 0o600,
      });
      console.log(JSON.stringify({ ...report, recoveryPath }));
    }
  },
  180000,
);
