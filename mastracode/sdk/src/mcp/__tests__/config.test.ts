import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_OAUTH_REDIRECT_URL,
  classifyServerEntry,
  expandEnvVars,
  loadMcpConfig,
  validateConfig,
} from '../config.js';

describe('classifyServerEntry', () => {
  it('classifies stdio entry', () => {
    expect(classifyServerEntry({ command: 'npx', args: ['-y', 'foo'] })).toEqual({ kind: 'stdio' });
  });

  it('classifies http entry', () => {
    expect(classifyServerEntry({ url: 'https://mcp.example.com/sse' })).toEqual({ kind: 'http' });
  });

  it('skips entry with both command and url', () => {
    const result = classifyServerEntry({ command: 'npx', url: 'https://example.com' });
    expect(result.kind).toBe('skip');
    expect(result.reason).toContain('Cannot specify both');
  });

  it('skips entry with neither command nor url', () => {
    const result = classifyServerEntry({ args: ['foo'] });
    expect(result.kind).toBe('skip');
    expect(result.reason).toContain('Missing required field');
  });

  it('skips non-object entry', () => {
    expect(classifyServerEntry('string')).toEqual({ kind: 'skip', reason: 'Invalid entry: expected an object' });
    expect(classifyServerEntry(null)).toEqual({ kind: 'skip', reason: 'Invalid entry: expected an object' });
    expect(classifyServerEntry(42)).toEqual({ kind: 'skip', reason: 'Invalid entry: expected an object' });
  });

  it('skips entry with invalid URL', () => {
    const result = classifyServerEntry({ url: 'not a url' });
    expect(result.kind).toBe('skip');
    expect(result.reason).toContain('Invalid URL');
  });

  it('accepts http entry with various valid URL schemes', () => {
    expect(classifyServerEntry({ url: 'http://localhost:8080/sse' }).kind).toBe('http');
    expect(classifyServerEntry({ url: 'https://mcp.example.com/mcp' }).kind).toBe('http');
  });

  it('accepts http entry whose url uses ${VAR} that resolves to a valid URL', () => {
    const previous = process.env.MC_TEST_MCP_URL;
    process.env.MC_TEST_MCP_URL = 'https://mcp.example.com/mcp';
    try {
      expect(classifyServerEntry({ url: '${MC_TEST_MCP_URL}' }).kind).toBe('http');
    } finally {
      if (previous === undefined) delete process.env.MC_TEST_MCP_URL;
      else process.env.MC_TEST_MCP_URL = previous;
    }
  });
});

describe('validateConfig', () => {
  it('returns empty for null/undefined input', () => {
    expect(validateConfig(null)).toEqual({});
    expect(validateConfig(undefined)).toEqual({});
  });

  it('returns empty when mcpServers is missing', () => {
    expect(validateConfig({ other: 'field' })).toEqual({});
  });

  it('accepts stdio server entry', () => {
    const result = validateConfig({
      mcpServers: {
        fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } },
      },
    });
    expect(result.mcpServers).toEqual({
      fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } },
    });
    expect(result.skippedServers).toBeUndefined();
  });

  it('accepts http server entry', () => {
    const result = validateConfig({
      mcpServers: {
        remote: { url: 'https://mcp.example.com/sse' },
      },
    });
    expect(result.mcpServers).toEqual({
      remote: { url: 'https://mcp.example.com/sse', headers: undefined },
    });
  });

  it('accepts http server entry with headers', () => {
    const result = validateConfig({
      mcpServers: {
        remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
      },
    });
    expect(result.mcpServers!['remote']).toEqual({
      url: 'https://mcp.example.com/sse',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('expands ${VAR} references in http header values from the environment', () => {
    const previous = process.env.MC_TEST_MCP_KEY;
    process.env.MC_TEST_MCP_KEY = 'secret-123';
    try {
      const result = validateConfig({
        mcpServers: {
          remote: { url: 'https://api.example.com/mcp', headers: { 'x-api-key': '${MC_TEST_MCP_KEY}' } },
        },
      });
      expect(result.mcpServers!['remote']).toEqual({
        url: 'https://api.example.com/mcp',
        headers: { 'x-api-key': 'secret-123' },
      });
    } finally {
      if (previous === undefined) delete process.env.MC_TEST_MCP_KEY;
      else process.env.MC_TEST_MCP_KEY = previous;
    }
  });

  it('expands ${VAR} references in the http url from the environment', () => {
    const previous = process.env.MC_TEST_MCP_URL;
    process.env.MC_TEST_MCP_URL = 'https://api.example.com/mcp';
    try {
      const result = validateConfig({
        mcpServers: {
          remote: { url: '${MC_TEST_MCP_URL}' },
        },
      });
      expect(result.mcpServers!['remote']).toEqual({
        url: 'https://api.example.com/mcp',
        headers: undefined,
      });
    } finally {
      if (previous === undefined) delete process.env.MC_TEST_MCP_URL;
      else process.env.MC_TEST_MCP_URL = previous;
    }
  });

  it('expands ${VAR} references in stdio env values from the environment', () => {
    const previous = process.env.MC_TEST_MCP_KEY;
    process.env.MC_TEST_MCP_KEY = 'secret-123';
    try {
      const result = validateConfig({
        mcpServers: {
          fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { API_KEY: '${MC_TEST_MCP_KEY}' } },
        },
      });
      expect(result.mcpServers!['fs']).toEqual({
        command: 'npx',
        args: ['-y', 'mcp-fs'],
        env: { API_KEY: 'secret-123' },
      });
    } finally {
      if (previous === undefined) delete process.env.MC_TEST_MCP_KEY;
      else process.env.MC_TEST_MCP_KEY = previous;
    }
  });

  it('accepts http server entry with OAuth config', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: {
            redirectUrl: 'http://localhost:3000/oauth/callback',
            clientName: 'Mastra Code',
            scopes: ['mcp:read', 'mcp:write'],
            clientId: 'client-id',
            clientSecret: 'client-secret',
          },
        },
      },
    });

    expect(result.mcpServers!['remote']).toEqual({
      url: 'https://mcp.example.com/sse',
      headers: undefined,
      oauth: {
        redirectUrl: 'http://localhost:3000/oauth/callback',
        clientName: 'Mastra Code',
        scopes: ['mcp:read', 'mcp:write'],
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
    });
  });

  it('applies the default loopback redirect URL when oauth.redirectUrl is omitted', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          oauth: {},
        },
      },
    });

    expect(result.skippedServers).toBeUndefined();
    expect((result.mcpServers!['remote'] as { oauth?: { redirectUrl: string } }).oauth?.redirectUrl).toBe(
      DEFAULT_OAUTH_REDIRECT_URL,
    );
  });

  it('rejects a non-string oauth.redirectUrl', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          oauth: { redirectUrl: 42 },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toEqual([
      { name: 'remote', reason: 'Invalid OAuth config: "redirectUrl" must be a string' },
    ]);
  });

  it('synthesizes a localhost redirect URL from oauth.callbackPort', () => {
    // Slack's official MCP plugin config uses `clientId` + `callbackPort`
    // (the Claude Code / Codex convention) — it must paste verbatim.
    const result = validateConfig({
      mcpServers: {
        slack: {
          url: 'https://mcp.slack.com/mcp',
          oauth: { clientId: 'slack-client-id', callbackPort: 3118 },
        },
      },
    });

    expect(result.skippedServers).toBeUndefined();
    expect((result.mcpServers!['slack'] as { oauth?: { redirectUrl: string } }).oauth?.redirectUrl).toBe(
      'http://localhost:3118/callback',
    );
  });

  it('rejects oauth config that sets both redirectUrl and callbackPort', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          oauth: { redirectUrl: 'http://localhost:3000/oauth/callback', callbackPort: 3118 },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toEqual([
      { name: 'remote', reason: 'Invalid OAuth config: set either "redirectUrl" or "callbackPort", not both' },
    ]);
  });

  it.each([0, 65536, -1])('rejects an out-of-range oauth.callbackPort: %p', callbackPort => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          oauth: { callbackPort },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toEqual([
      { name: 'remote', reason: 'Invalid OAuth config: "callbackPort" must be an integer between 1 and 65535' },
    ]);
  });

  it.each([3118.5, '3118', true])('rejects a non-integer oauth.callbackPort: %p', callbackPort => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          oauth: { callbackPort },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toEqual([
      { name: 'remote', reason: 'Invalid OAuth config: "callbackPort" must be an integer between 1 and 65535' },
    ]);
  });

  it('accepts loopback IPv6 HTTP OAuth redirect URLs', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: { redirectUrl: 'http://[::1]:3000/oauth/callback' },
        },
      },
    });

    expect(result.mcpServers!['remote']).toEqual({
      url: 'https://mcp.example.com/sse',
      headers: undefined,
      oauth: {
        redirectUrl: 'http://[::1]:3000/oauth/callback',
        clientName: undefined,
        scopes: undefined,
        clientId: undefined,
        clientSecret: undefined,
      },
    });
  });

  it('accepts IPv4 loopback range HTTP OAuth redirect URLs', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: { redirectUrl: 'http://127.0.0.2:3000/oauth/callback' },
        },
      },
    });

    expect(result.mcpServers!['remote']).toEqual({
      url: 'https://mcp.example.com/sse',
      headers: undefined,
      oauth: {
        redirectUrl: 'http://127.0.0.2:3000/oauth/callback',
        clientName: undefined,
        scopes: undefined,
        clientId: undefined,
        clientSecret: undefined,
      },
    });
  });

  it('skips http server entry with invalid OAuth config', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: { redirectUrl: 'not a url' },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toHaveLength(1);
    expect(result.skippedServers![0]!.reason).toContain('Invalid OAuth redirectUrl');
  });

  it('skips http server entry with non-loopback HTTP OAuth redirect URL', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: { redirectUrl: 'http://oauth.example.com/callback' },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toHaveLength(1);
    expect(result.skippedServers![0]!.reason).toContain('must use HTTPS');
  });

  it('rejects an HTTP OAuth redirect URL whose host only looks like a loopback address', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: { redirectUrl: 'http://127.evil.com/callback' },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toHaveLength(1);
    expect(result.skippedServers![0]!.reason).toContain('must use HTTPS');
  });

  it('skips http server entry with invalid OAuth scopes', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/sse',
          oauth: {
            redirectUrl: 'http://localhost:3000/oauth/callback',
            scopes: ['mcp:read', 42],
          },
        },
      },
    });

    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toHaveLength(1);
    expect(result.skippedServers![0]!.reason).toContain('"scopes" must be an array of strings');
  });

  it('skips invalid entries and collects reasons', () => {
    const result = validateConfig({
      mcpServers: {
        good: { command: 'npx', args: [] },
        bad: { args: ['orphan'] },
        worse: { command: 'npx', url: 'https://example.com' },
      },
    });
    expect(result.mcpServers).toEqual({
      good: { command: 'npx', args: [], env: undefined },
    });
    expect(result.skippedServers).toHaveLength(2);
    expect(result.skippedServers!.find(s => s.name === 'bad')!.reason).toContain('Missing required field');
    expect(result.skippedServers!.find(s => s.name === 'worse')!.reason).toContain('Cannot specify both');
  });

  it('skips entry with invalid URL', () => {
    const result = validateConfig({
      mcpServers: {
        broken: { url: 'not-a-url' },
      },
    });
    expect(result.mcpServers).toBeUndefined();
    expect(result.skippedServers).toHaveLength(1);
    expect(result.skippedServers![0]!.reason).toContain('Invalid URL');
  });

  it('handles mixed valid stdio and http entries', () => {
    const result = validateConfig({
      mcpServers: {
        local: { command: 'node', args: ['server.js'] },
        remote: { url: 'https://api.example.com/mcp' },
      },
    });
    expect(Object.keys(result.mcpServers!)).toEqual(['local', 'remote']);
    expect(result.skippedServers).toBeUndefined();
  });

  it('strips invalid args and env gracefully', () => {
    const result = validateConfig({
      mcpServers: {
        s: { command: 'cmd', args: 'not-an-array', env: 'not-an-object' },
      },
    });
    expect(result.mcpServers!['s']).toEqual({
      command: 'cmd',
      args: undefined,
      env: undefined,
    });
  });
});

describe('expandEnvVars', () => {
  const env = { TOKEN: 'abc', API_KEY: 'secret-123', EMPTY: '' };

  it('expands a ${VAR} reference', () => {
    expect(expandEnvVars('${API_KEY}', env)).toBe('secret-123');
  });

  it('expands references embedded in a larger string', () => {
    expect(expandEnvVars('Bearer ${TOKEN}', env)).toBe('Bearer abc');
  });

  it('uses the ${VAR:-default} fallback when the variable is unset or empty', () => {
    expect(expandEnvVars('${MISSING:-fallback}', env)).toBe('fallback');
    expect(expandEnvVars('${EMPTY:-fallback}', env)).toBe('fallback');
  });

  it('expands an unset reference with no default to an empty string', () => {
    expect(expandEnvVars('${MISSING}', env)).toBe('');
  });

  it('leaves strings without references untouched', () => {
    expect(expandEnvVars('plain value with a $ sign', env)).toBe('plain value with a $ sign');
  });

  it('expands a bare $VAR reference', () => {
    expect(expandEnvVars('$API_KEY', env)).toBe('secret-123');
    expect(expandEnvVars('Bearer $TOKEN', env)).toBe('Bearer abc');
  });

  it('expands an unset bare $VAR reference to an empty string', () => {
    expect(expandEnvVars('$MISSING', env)).toBe('');
  });

  it('does not treat $ followed by a non-identifier as a reference', () => {
    expect(expandEnvVars('it costs $5 today', env)).toBe('it costs $5 today');
  });
});

describe('loadMcpConfig', () => {
  let projectDir: string;
  let homeDir: string;
  let previousHome: string | undefined;
  let previousUserProfile: string | undefined;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-config-'));
    // Isolate the global ~/.mastracode/mcp.json so a developer's real config
    // cannot leak into assertions (os.homedir() reads HOME / USERPROFILE).
    homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-home-'));
    previousHome = process.env.HOME;
    previousUserProfile = process.env.USERPROFILE;
    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  function writeJson(filePath: string, data: unknown): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data));
  }

  it('reads MCP servers from a root .mcp.json (Claude Code compatible)', () => {
    writeJson(path.join(projectDir, '.mcp.json'), {
      mcpServers: { root: { url: 'https://root.example.com/mcp' } },
    });

    const config = loadMcpConfig(projectDir);

    expect(config.mcpServers).toEqual({
      root: { url: 'https://root.example.com/mcp', headers: undefined },
    });
  });

  it('lets .mastracode/mcp.json override root .mcp.json by server name', () => {
    writeJson(path.join(projectDir, '.mcp.json'), {
      mcpServers: { shared: { command: 'root-cmd' } },
    });
    writeJson(path.join(projectDir, '.mastracode', 'mcp.json'), {
      mcpServers: { shared: { command: 'project-cmd' } },
    });

    const config = loadMcpConfig(projectDir);

    expect(config.mcpServers!['shared']).toEqual({ command: 'project-cmd', args: undefined, env: undefined });
  });

  it('merges distinct servers from root .mcp.json and .mastracode/mcp.json', () => {
    writeJson(path.join(projectDir, '.mcp.json'), {
      mcpServers: { fromRoot: { command: 'a' } },
    });
    writeJson(path.join(projectDir, '.mastracode', 'mcp.json'), {
      mcpServers: { fromProject: { command: 'b' } },
    });

    const config = loadMcpConfig(projectDir);

    expect(Object.keys(config.mcpServers!).sort()).toEqual(['fromProject', 'fromRoot']);
  });

  it('lets a root .mcp.json override the global ~/.mastracode/mcp.json by server name', () => {
    writeJson(path.join(homeDir, '.mastracode', 'mcp.json'), {
      mcpServers: { shared: { command: 'global-cmd' } },
    });
    writeJson(path.join(projectDir, '.mcp.json'), {
      mcpServers: { shared: { command: 'root-cmd' } },
    });

    const config = loadMcpConfig(projectDir);

    expect(config.mcpServers!['shared']).toEqual({ command: 'root-cmd', args: undefined, env: undefined });
  });

  it('lets a root .mcp.json override .claude/settings.local.json by server name', () => {
    writeJson(path.join(projectDir, '.claude', 'settings.local.json'), {
      mcpServers: { shared: { command: 'claude-cmd' } },
    });
    writeJson(path.join(projectDir, '.mcp.json'), {
      mcpServers: { shared: { command: 'root-cmd' } },
    });

    const config = loadMcpConfig(projectDir);

    expect(config.mcpServers!['shared']).toEqual({ command: 'root-cmd', args: undefined, env: undefined });
  });
});
