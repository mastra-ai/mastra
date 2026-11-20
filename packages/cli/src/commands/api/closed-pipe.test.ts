import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const commandModule = fileURLToPath(new URL('./index.ts', import.meta.url));
// The inline child script resolves `commander` and `tsx` from its cwd, so run it from the CLI package
// rather than wherever vitest was started (CI runs from the repo root).
const cliPackageDir = fileURLToPath(new URL('../../../', import.meta.url));
const bigRows = Array.from({ length: 100_000 }, (_, id) => ({ id, city: `City ${id}` }));

let server: Server;
let baseUrl: string;
const requestedPaths: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    requestedPaths.push(`${req.method} ${req.url}`);
    const status = req.url?.includes('/tools/failing-tool/') ? 500 : 200;
    const body = status === 200 ? { rows: bigRows, rowCount: bigRows.length } : { error: 'x'.repeat(2_000_000) };
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

/**
 * Runs `mastra api tool execute <toolId>` through the real command in a child process and closes the
 * read end of `closedStream` after its first chunk, like `| head` does.
 */
function runToolExecute(toolId: string, closedStream: 'stdout' | 'stderr') {
  const openStream = closedStream === 'stdout' ? 'stderr' : 'stdout';
  const script = `
    const { Command } = await import("commander");
    const { registerApiCommand } = await import(${JSON.stringify(commandModule)});
    const program = new Command();
    registerApiCommand(program);
    await program.parseAsync(["api", "--url", ${JSON.stringify(baseUrl)}, "tool", "execute", ${JSON.stringify(toolId)}, '{"query":"SELECT * FROM cities"}'], { from: "user" });
    // Printed only if the process survives the broken pipe instead of crashing on EPIPE.
    setTimeout(() => process[${JSON.stringify(openStream)}].write("SURVIVED"), 200);
  `;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: cliPackageDir,
    env: { ...process.env, MASTRA_TELEMETRY_DISABLED: '1' },
  });

  const output = { stdout: '', stderr: '' };
  child[openStream].on('data', chunk => (output[openStream] += chunk));
  child[closedStream].once('data', () => child[closedStream].destroy());

  return new Promise<{ code: number | null; output: typeof output }>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}

describe('mastra api output when the reader closes the pipe early', () => {
  it('exits 0 without error output after a successful request', async () => {
    const { code, output } = await runToolExecute('execute-sql', 'stdout');

    expect(requestedPaths).toContain('POST /api/tools/execute-sql/execute');
    expect(output.stderr).toBe('SURVIVED');
    expect(code).toBe(0);
  }, 30_000);

  it('still exits 1 after a failed request', async () => {
    const { code, output } = await runToolExecute('failing-tool', 'stderr');

    expect(requestedPaths).toContain('POST /api/tools/failing-tool/execute');
    expect(output.stdout).toBe('SURVIVED');
    expect(code).toBe(1);
  }, 30_000);
});
