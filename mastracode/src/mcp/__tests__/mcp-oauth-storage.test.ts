import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { McpOAuthFileStorage } from '../mcp-oauth-storage.js';

describe('McpOAuthFileStorage', () => {
  let testDir: string;
  let filePath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `mcp-oauth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    filePath = join(testDir, 'mcp-oauth.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('stores and retrieves values', () => {
    const storage = new McpOAuthFileStorage('server1', filePath);
    storage.set('tokens', '{"access_token":"abc"}');
    expect(storage.get('tokens')).toBe('{"access_token":"abc"}');
  });

  it('returns undefined for missing keys', () => {
    const storage = new McpOAuthFileStorage('server1', filePath);
    expect(storage.get('nonexistent')).toBeUndefined();
  });

  it('deletes values', () => {
    const storage = new McpOAuthFileStorage('server1', filePath);
    storage.set('tokens', 'value');
    storage.delete('tokens');
    expect(storage.get('tokens')).toBeUndefined();
  });

  it('persists to disk', () => {
    const storage = new McpOAuthFileStorage('server1', filePath);
    storage.set('tokens', '{"access_token":"persisted"}');

    expect(existsSync(filePath)).toBe(true);
    const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(onDisk.server1.tokens).toBe('{"access_token":"persisted"}');
  });

  it('isolates data between server namespaces', () => {
    const storage1 = new McpOAuthFileStorage('server1', filePath);
    storage1.set('tokens', 'token1');

    const storage2 = new McpOAuthFileStorage('server2', filePath);
    storage2.set('tokens', 'token2');

    expect(storage1.get('tokens')).toBe('token1');
    expect(storage2.get('tokens')).toBe('token2');

    const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(onDisk.server1.tokens).toBe('token1');
    expect(onDisk.server2.tokens).toBe('token2');
  });

  it('loads existing data from disk on construction', () => {
    writeFileSync(filePath, JSON.stringify({ myserver: { tokens: 'existing' } }), 'utf-8');

    const storage = new McpOAuthFileStorage('myserver', filePath);
    expect(storage.get('tokens')).toBe('existing');
  });

  it('handles missing file gracefully', () => {
    const storage = new McpOAuthFileStorage('server1', join(testDir, 'nonexistent.json'));
    expect(storage.get('anything')).toBeUndefined();
  });

  it('handles corrupt file gracefully', () => {
    writeFileSync(filePath, 'not json', 'utf-8');
    const storage = new McpOAuthFileStorage('server1', filePath);
    expect(storage.get('anything')).toBeUndefined();
  });

  it('does not overwrite other server data on delete', () => {
    const storage1 = new McpOAuthFileStorage('server1', filePath);
    storage1.set('tokens', 'keep-this');

    const storage2 = new McpOAuthFileStorage('server2', filePath);
    storage2.set('tokens', 'delete-this');
    storage2.delete('tokens');

    const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(onDisk.server1.tokens).toBe('keep-this');
    expect(onDisk.server2.tokens).toBeUndefined();
  });
});
