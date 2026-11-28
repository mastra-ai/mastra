import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pdfParserCommand } from '../scripts/pdf-parser-command.js';

function run(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      });
    });
  });
}

describe('PDF parser launcher', () => {
  it('passes a shell-looking worker path as an argument and applies process limits', async () => {
    // Technical: sh runs pdf-limits.sh as a file, so the worker path is not shell source. (SEC-328)
    const root = await mkdtemp(join(tmpdir(), 'pdf-limits-'));
    const marker = join(root, 'pwned');
    const workerPath = join(root, '$(touch pwned).mjs');
    try {
      await writeFile(
        workerPath,
        [
          "import { readFileSync } from 'node:fs';",
          "const limits = readFileSync('/proc/self/limits', 'utf8');",
          'process.stdout.write(limits);',
          "process.stdout.write('\\nSCRIPT ' + process.argv[1]);",
        ].join('\n'),
      );
      const launched = pdfParserCommand(workerPath);
      const result = await run(launched.command, launched.args, root);

      expect(result.code, result.stderr).toBe(0);
      expect(launched.args).not.toContain('-c');
      expect(existsSync(marker)).toBe(false);
      expect(result.stdout).toMatch(/Max cpu time\s+10\s+/);
      expect(result.stdout).toMatch(/Max core file size\s+0\s+/);
      expect(result.stdout).toContain(`SCRIPT ${workerPath}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
