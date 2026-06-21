import { describe, expect, it } from 'vitest';

import { classifyServerEntry, expandEnvVars, validateConfig } from '../config.js';

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
});
