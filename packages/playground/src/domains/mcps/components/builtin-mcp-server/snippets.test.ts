// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildConnectSnippets, TOKEN_PLACEHOLDER } from './snippets';

const HOSTILE_URLS = [
  'http://localhost:4111/api/mcp&readonly=1',
  'http://localhost:4111/api/mcp;touch pwned',
  'http://localhost:4111/api/$(touch pwned)',
  'http://localhost:4111/api/`touch pwned`',
  "http://localhost:4111/api/it's",
];

function snippet(url: string, protectedServer: boolean, value: string): string {
  const found = buildConnectSnippets(url, { protectedServer }).find(s => s.value === value);
  if (!found) throw new Error(`no ${value} snippet`);
  return found.code;
}

describe('buildConnectSnippets', () => {
  describe('when the endpoint URL contains shell metacharacters', () => {
    it.each(HOSTILE_URLS)('single-quotes the URL in the Claude Code command: %s', url => {
      const quoted = `'${url.replaceAll("'", `'\\''`)}'`;
      expect(snippet(url, false, 'claude-code')).toBe(`claude mcp add --transport http mastra ${quoted}`);
    });

    it.each(HOSTILE_URLS)('single-quotes the URL in the Inspector command: %s', url => {
      const quoted = `'${url.replaceAll("'", `'\\''`)}'`;
      expect(snippet(url, false, 'inspector')).toBe(
        `npx @modelcontextprotocol/inspector --cli ${quoted} --transport http --method tools/list`,
      );
    });

    it.each(HOSTILE_URLS)('keeps the URL unchanged in the Cursor and VS Code JSON: %s', url => {
      expect(JSON.parse(snippet(url, true, 'cursor')).mcpServers.mastra.url).toBe(url);
      expect(JSON.parse(snippet(url, true, 'vscode')).servers.mastra.url).toBe(url);
    });
  });

  describe('when the shell commands are run by bash', () => {
    let binDir: string;
    let argvLog: string;

    beforeAll(() => {
      binDir = mkdtempSync(path.join(tmpdir(), 'mcp-snippets-'));
      argvLog = path.join(binDir, 'argv.json');
      // Stub `claude` and `npx` that record the argv they receive as JSON.
      const stub = `#!/usr/bin/env node\nrequire('fs').writeFileSync(${JSON.stringify(argvLog)}, JSON.stringify(process.argv.slice(2)));\n`;
      for (const name of ['claude', 'npx']) {
        writeFileSync(path.join(binDir, name), stub);
        chmodSync(path.join(binDir, name), 0o755);
      }
    });

    afterAll(() => rmSync(binDir, { recursive: true, force: true }));

    function run(code: string): string[] {
      rmSync(argvLog, { force: true });
      // `wait` lets a command backgrounded by `&` in an unquoted URL finish before the log is read.
      execFileSync('bash', ['-c', `${code}; wait`], {
        cwd: binDir,
        env: { PATH: `${binDir}:${path.dirname(process.execPath)}:/usr/bin:/bin` },
      });
      return JSON.parse(readFileSync(argvLog, 'utf8'));
    }

    it.each(HOSTILE_URLS)('passes the URL to claude as one unmodified argument: %s', url => {
      expect(run(snippet(url, true, 'claude-code'))).toEqual([
        'mcp',
        'add',
        '--transport',
        'http',
        'mastra',
        url,
        '--header',
        `Authorization: Bearer ${TOKEN_PLACEHOLDER}`,
      ]);
    });

    it.each(HOSTILE_URLS)('passes the URL to the Inspector as one unmodified argument: %s', url => {
      expect(run(snippet(url, true, 'inspector'))).toEqual([
        '@modelcontextprotocol/inspector',
        '--cli',
        url,
        '--transport',
        'http',
        '--header',
        `Authorization: Bearer ${TOKEN_PLACEHOLDER}`,
        '--method',
        'tools/list',
      ]);
    });

    it.each(HOSTILE_URLS)('runs nothing embedded in the URL: %s', url => {
      rmSync(path.join(binDir, 'pwned'), { force: true });
      run(snippet(url, true, 'claude-code'));
      run(snippet(url, true, 'inspector'));
      expect(existsSync(path.join(binDir, 'pwned'))).toBe(false);
    });
  });
});
