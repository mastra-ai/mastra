import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { LocalSandbox } from '../sandbox/local-sandbox';
import { LSPClient, diagnosticsKey } from './client';
import type { LSPServerDef } from './types';

describe('diagnosticsKey', () => {
  it('returns the same key for Windows file URIs that differ in drive-letter case and colon encoding', () => {
    const fromPathToFileURL = 'file:///C:/Users/me/res/client.lua';
    const fromVscodeUri = 'file:///c%3A/Users/me/res/client.lua';

    expect(diagnosticsKey(fromPathToFileURL)).toBe(diagnosticsKey(fromVscodeUri));
  });

  it('lowercases the drive letter', () => {
    const key = diagnosticsKey('file:///C:/Users/me/res/client.lua');
    expect(key).toContain('c:');
    expect(key).not.toContain('C:');
  });

  it('returns a normal posix path unchanged', () => {
    const key = diagnosticsKey('file:///home/me/res/client.lua');
    expect(key).toBe('/home/me/res/client.lua');
  });

  it('passes through non-file-URI strings unchanged', () => {
    expect(diagnosticsKey('/already/a/path.ts')).toBe('/already/a/path.ts');
  });
});

/**
 * A minimal fake LSP server: answers the `initialize` request correctly, then
 * closes its stdin while staying alive. From the client's point of view the
 * connection still looks healthy (stdout is open, the process is running), so
 * the next request goes through the full stream write path and fails with
 * EPIPE — the same failure mode as a language server that hangs or dies while
 * a request is being written to it.
 */
const FAKE_SERVER_SCRIPT = `
const fs = require('node:fs');
const markerPath = process.argv[2];
let buf = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const headerEnd = buf.indexOf('\\r\\n\\r\\n');
    if (headerEnd === -1) return;
    const header = buf.subarray(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length: (\\d+)/);
    if (!match) return;
    const bodyStart = headerEnd + 4;
    const length = parseInt(match[1], 10);
    if (buf.length < bodyStart + length) return;
    let msg;
    try {
      msg = JSON.parse(buf.subarray(bodyStart, bodyStart + length).toString('utf8'));
    } catch {
      return;
    }
    buf = buf.subarray(bodyStart + length);
    if (msg.method === 'initialize') {
      const response = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { capabilities: {} } });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(response) + '\\r\\n\\r\\n' + response, () => {
        // Close the read end of the stdin pipe while staying alive, so the
        // client's next write hits EPIPE instead of a closed connection.
        process.stdin.pause();
        fs.closeSync(0);
        setImmediate(() => fs.writeFileSync(markerPath, 'closed'));
      });
    }
  }
});
// Stay alive so the connection does not observe the server going away.
const keepalive = setInterval(() => {}, 1000);
// Safety net: never outlive the test run.
setTimeout(() => { clearInterval(keepalive); process.exit(0); }, 15000).unref();
`;

describe('LSPClient — server write failures', () => {
  let dir: string;
  let sandbox: LocalSandbox;
  let client: LSPClient;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'lsp-client-test-'));
    sandbox = new LocalSandbox({ workingDirectory: dir });
    await sandbox.start();
  });

  afterEach(async () => {
    await client?.shutdown().catch(() => {});
    await sandbox.stop().catch(() => {});
    await rm(dir, { recursive: true, force: true });
  });

  // EPIPE pipe semantics are POSIX-specific; the crash this guards against is
  // platform-independent (it lives in vscode-jsonrpc), so one platform suffices.
  it.skipIf(process.platform === 'win32')(
    'does not leak an unhandled rejection when a request write fails (EPIPE)',
    async () => {
      const scriptPath = path.join(dir, 'fake-lsp-server.cjs');
      const markerPath = path.join(dir, 'stdin-closed.marker');
      await writeFile(scriptPath, FAKE_SERVER_SCRIPT, 'utf8');

      const serverDef: LSPServerDef = {
        id: 'fake',
        name: 'Fake LSP',
        languageIds: ['plaintext'],
        markers: [],
        // `exec` so node replaces the intermediate shell — otherwise the shell
        // keeps the stdin pipe's read end open and the write never hits EPIPE.
        command: () => `exec node "${scriptPath}" "${markerPath}"`,
      };

      client = new LSPClient(serverDef, dir, sandbox.processes);
      await client.initialize(5000);

      // Wait until the fake server has closed its stdin.
      await vi.waitFor(() => expect(existsSync(markerPath)).toBe(true), { timeout: 5000 });

      // Track unhandled rejections. Without the writer-rejection guard in
      // LSPClient.initialize, vscode-jsonrpc re-throws the stream write error
      // inside an async promise executor nothing awaits, which surfaces as an
      // unhandled rejection and crashes the host process.
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        // The request must fail cleanly (timeout or write error) — not crash.
        await expect(
          client.queryHover(`file://${dir}/some-file.txt`, { line: 0, character: 0 }, 1000),
        ).rejects.toThrow();

        // Give any stray rejection a macrotask to surface.
        await new Promise(resolve => setTimeout(resolve, 250));
        expect(unhandled).toEqual([]);
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
    },
    20000,
  );
});
