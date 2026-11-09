import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isExecutableFile, resolveScriptCommand, runScript } from './run-script.js';

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-schedules-'));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(name: string, body: string, mode = 0o644): string {
  const abs = path.join(dir, name);
  fs.writeFileSync(abs, body, { mode });
  return abs;
}

describe('resolveScriptCommand', () => {
  it('runs executable files directly', () => {
    const abs = write('direct.sh', '#!/bin/sh\necho hi\n', 0o755);
    expect(isExecutableFile(abs)).toBe(true);
    expect(resolveScriptCommand(abs)).toEqual({ command: abs, args: [] });
  });

  it('routes non-executable known extensions through a fixed interpreter', () => {
    const sh = write('plain.sh', 'echo hi\n');
    const js = write('plain.js', 'console.log(1)\n');
    expect(resolveScriptCommand(sh)).toEqual({ command: '/bin/sh', args: [sh] });
    expect(resolveScriptCommand(js)).toEqual({ command: process.execPath, args: [js] });
  });

  it('rejects non-executable files with no known interpreter', () => {
    const abs = write('plain.txt', 'hello\n');
    expect(() => resolveScriptCommand(abs)).toThrow(/no known interpreter/);
  });
});

describe('runScript', () => {
  it('captures stdout, stderr, and exit code with the workspace cwd', async () => {
    const abs = write('report.sh', 'echo "in $(basename "$PWD")"\necho oops >&2\nexit 3\n');
    const result = await runScript(abs, { cwd: dir, timeoutMs: 5_000 });
    expect(result).toEqual({ stdout: `in ${path.basename(dir)}\n`, stderr: 'oops\n', exitCode: 3 });
  });

  it('never passes user text through a shell: the path is the only argument', async () => {
    const tricky = write('args.sh', 'echo "argc=$#"\n');
    const result = await runScript(tricky, { cwd: dir, timeoutMs: 5_000 });
    expect(result.stdout).toBe('argc=0\n');
  });

  it('reports a timeout as exit null with a note', async () => {
    const abs = write('slow.sh', 'sleep 5\n');
    const result = await runScript(abs, { cwd: dir, timeoutMs: 200 });
    expect(result.exitCode).toBeNull();
    expect(result.stderr).toMatch(/timed out after 200ms/);
  });

  it('rejects when the file cannot be executed at all', async () => {
    await expect(runScript(path.join(dir, 'missing.txt'), { cwd: dir, timeoutMs: 1_000 })).rejects.toThrow();
  });
});
