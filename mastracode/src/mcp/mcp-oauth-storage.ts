/**
 * File-backed OAuth storage for MCP servers.
 * Implements @mastra/mcp's OAuthStorage interface using a JSON file,
 * with keys namespaced per server to isolate credentials.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { OAuthStorage } from '@mastra/mcp';

/**
 * Persists MCP OAuth data (tokens, client info, PKCE verifiers) to a JSON file.
 * Each server gets its own namespace to prevent collisions.
 */
export class McpOAuthFileStorage implements OAuthStorage {
  private data: Record<string, string> = {};

  constructor(
    private readonly serverName: string,
    private readonly filePath: string,
  ) {
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      this.data = {};
      return;
    }
    try {
      const all = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      this.data = all?.[this.serverName] ?? {};
    } catch {
      this.data = {};
    }
  }

  private persist(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    let all: Record<string, Record<string, string>> = {};
    if (existsSync(this.filePath)) {
      try {
        all = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      } catch {
        all = {};
      }
    }
    all[this.serverName] = this.data;
    writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf-8');
    chmodSync(this.filePath, 0o600);
  }

  set(key: string, value: string): void {
    this.data[key] = value;
    this.persist();
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  delete(key: string): void {
    delete this.data[key];
    this.persist();
  }
}
