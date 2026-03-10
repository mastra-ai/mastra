import { describe, expect, it } from 'vitest';

import { classifyServerEntry, validateConfig } from '../config.js';

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

  it('accepts http server entry with auth: "oauth"', () => {
    const result = validateConfig({
      mcpServers: {
        remote: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
      },
    });
    const cfg = result.mcpServers!['remote'] as any;
    expect(cfg.url).toBe('https://mcp.example.com/mcp');
    expect(cfg.auth).toBe('oauth');
  });

  it('accepts http server entry with both headers and auth', () => {
    const result = validateConfig({
      mcpServers: {
        remote: {
          url: 'https://mcp.example.com/mcp',
          headers: { 'X-Custom': 'static' },
          auth: 'oauth',
        },
      },
    });
    const cfg = result.mcpServers!['remote'] as any;
    expect(cfg.url).toBe('https://mcp.example.com/mcp');
    expect(cfg.headers).toEqual({ 'X-Custom': 'static' });
    expect(cfg.auth).toBe('oauth');
  });

  it('ignores non-oauth auth values', () => {
    const result = validateConfig({
      mcpServers: {
        remote: { url: 'https://mcp.example.com/mcp', auth: 'basic' },
      },
    });
    const cfg = result.mcpServers!['remote'] as any;
    expect(cfg.auth).toBeUndefined();
  });

  it('ignores non-string auth values', () => {
    const result = validateConfig({
      mcpServers: {
        remote: { url: 'https://mcp.example.com/mcp', auth: 123 },
      },
    });
    const cfg = result.mcpServers!['remote'] as any;
    expect(cfg.auth).toBeUndefined();
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
