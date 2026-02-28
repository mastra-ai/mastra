/**
 * MCP server configuration loading from filesystem.
 * Loads from:
 *   1. .claude/settings.local.json  (Claude Code compat — lowest priority)
 *   2. ~/.mastracode/mcp.json       (global)
 *   3. .mastracode/mcp.json         (project — highest priority)
 *
 * Project overrides global by server name. Claude Code config is lowest priority.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { McpConfig, McpServerConfig, McpSkippedServer } from './types.js';

export function loadMcpConfig(projectDir: string): McpConfig {
  const claudeConfig = loadClaudeSettings(projectDir);
  const globalConfig = loadSingleConfig(getGlobalMcpPath());
  const projectConfig = loadSingleConfig(getProjectMcpPath(projectDir));

  return mergeConfigs(claudeConfig, globalConfig, projectConfig);
}

export function getProjectMcpPath(projectDir: string): string {
  return path.join(projectDir, '.mastracode', 'mcp.json');
}

export function getGlobalMcpPath(): string {
  return path.join(os.homedir(), '.mastracode', 'mcp.json');
}

export function getClaudeSettingsPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'settings.local.json');
}

function loadSingleConfig(filePath: string): McpConfig {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    return validateConfig(JSON.parse(raw));
  } catch {
    return {};
  }
}

function loadClaudeSettings(projectDir: string): McpConfig {
  try {
    const filePath = getClaudeSettingsPath(projectDir);
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Claude Code stores mcpServers at the top level of settings
    if (parsed?.mcpServers && typeof parsed.mcpServers === 'object') {
      return validateConfig({ mcpServers: parsed.mcpServers });
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Classify a raw server entry as stdio, http, or skip (with reason).
 */
export function classifyServerEntry(raw: unknown): { kind: 'stdio' | 'http' | 'skip'; reason?: string } {
  if (!raw || typeof raw !== 'object') {
    return { kind: 'skip', reason: 'Invalid entry: expected an object' };
  }

  const obj = raw as Record<string, unknown>;
  const hasCommand = typeof obj.command === 'string';
  const hasUrl = typeof obj.url === 'string';

  if (hasCommand && hasUrl) {
    return { kind: 'skip', reason: 'Cannot specify both "command" and "url"' };
  }

  if (hasCommand) {
    return { kind: 'stdio' };
  }

  if (hasUrl) {
    try {
      new URL(obj.url as string);
    } catch {
      return { kind: 'skip', reason: `Invalid URL: "${obj.url}"` };
    }
    return { kind: 'http' };
  }

  return { kind: 'skip', reason: 'Missing required field: "command" (stdio) or "url" (http)' };
}

export function validateConfig(raw: unknown): McpConfig {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;

  if (!obj.mcpServers || typeof obj.mcpServers !== 'object') return {};

  const servers: Record<string, McpServerConfig> = {};
  const skippedServers: McpSkippedServer[] = [];
  const rawServers = obj.mcpServers as Record<string, unknown>;

  for (const [name, entry] of Object.entries(rawServers)) {
    const classification = classifyServerEntry(entry);

    if (classification.kind === 'stdio') {
      const e = entry as Record<string, unknown>;
      servers[name] = {
        command: e.command as string,
        args: Array.isArray(e.args) ? (e.args as string[]) : undefined,
        env: typeof e.env === 'object' && e.env !== null ? (e.env as Record<string, string>) : undefined,
      };
    } else if (classification.kind === 'http') {
      const e = entry as Record<string, unknown>;
      servers[name] = {
        url: e.url as string,
        headers: typeof e.headers === 'object' && e.headers !== null ? (e.headers as Record<string, string>) : undefined,
      };
    } else {
      skippedServers.push({ name, reason: classification.reason! });
    }
  }

  const result: McpConfig = {};
  if (Object.keys(servers).length > 0) {
    result.mcpServers = servers;
  }
  if (skippedServers.length > 0) {
    result.skippedServers = skippedServers;
  }
  return result;
}

/**
 * Merge configs: claude (lowest priority) < global < project (highest).
 * Later configs override earlier by server name.
 * Skipped entries are accumulated, but if a higher-priority config provides
 * a valid entry for a skipped name, the skip is removed.
 */
function mergeConfigs(...configs: McpConfig[]): McpConfig {
  const merged: Record<string, McpServerConfig> = {};
  const allSkipped: McpSkippedServer[] = [];

  for (const config of configs) {
    if (config.mcpServers) {
      for (const [name, server] of Object.entries(config.mcpServers)) {
        merged[name] = server;
      }
    }
    if (config.skippedServers) {
      allSkipped.push(...config.skippedServers);
    }
  }

  // Remove skipped entries that were resolved by a valid config at any priority
  const validNames = new Set(Object.keys(merged));
  const filteredSkipped = allSkipped.filter(s => !validNames.has(s.name));

  // Deduplicate skipped entries by name (keep last occurrence — highest priority reason)
  const skippedMap = new Map<string, McpSkippedServer>();
  for (const s of filteredSkipped) {
    skippedMap.set(s.name, s);
  }

  const result: McpConfig = {};
  if (Object.keys(merged).length > 0) {
    result.mcpServers = merged;
  }
  if (skippedMap.size > 0) {
    result.skippedServers = Array.from(skippedMap.values());
  }
  return result;
}
