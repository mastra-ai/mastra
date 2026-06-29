/**
 * MCP server configuration loading from filesystem.
 * Loads from:
 *   1. .claude/settings.local.json  (Claude Code compat — lowest priority)
 *   2. ~/.mastracode/mcp.json       (global)
 *   3. .mcp.json                    (project root — Claude Code compatible)
 *   4. .mastracode/mcp.json         (project — highest priority)
 *
 * Higher-priority configs override lower ones by server name. The project root
 * `.mcp.json` is read so a project that already keeps MCP servers there for
 * Claude Code does not need to duplicate them under `.mastracode/`.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import type { McpConfig, McpHttpOAuthConfig, McpServerConfig, McpSkippedServer } from './types.js';

export function loadMcpConfig(projectDir: string, configDirName = DEFAULT_CONFIG_DIR): McpConfig {
  const claudeConfig = loadClaudeSettings(projectDir);
  const globalConfig = loadSingleConfig(getGlobalMcpPath(configDirName));
  const rootConfig = loadSingleConfig(getRootMcpPath(projectDir));
  const projectConfig = loadSingleConfig(getProjectMcpPath(projectDir, configDirName));

  return mergeConfigs(claudeConfig, globalConfig, rootConfig, projectConfig);
}

export function getProjectMcpPath(projectDir: string, configDirName = DEFAULT_CONFIG_DIR): string {
  return path.join(projectDir, configDirName, 'mcp.json');
}

export function getRootMcpPath(projectDir: string): string {
  return path.join(projectDir, '.mcp.json');
}

export function getGlobalMcpPath(configDirName = DEFAULT_CONFIG_DIR): string {
  return path.join(os.homedir(), configDirName, 'mcp.json');
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
 * Expand `${VAR}` and `${VAR:-default}` references in a string from the
 * environment, matching how Claude Code resolves values in `.mcp.json`.
 * A referenced variable that is unset or empty falls back to its default,
 * or to an empty string when no default is given.
 */
export function expandEnvVars(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, bracedName, fallback, bareName) => {
      const name = bracedName ?? bareName;
      const resolved = env[name];
      if (resolved !== undefined && resolved !== '') return resolved;
      return fallback ?? '';
    },
  );
}

/**
 * Expand `${VAR}` and `$VAR` references in every string-valued HTTP header so that
 * secrets like API keys can be referenced from the environment instead of
 * being hardcoded in `mcp.json`.
 */
function expandHeaderEnvVars(headers: Record<string, unknown>): Record<string, string> {
  const expanded: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') expanded[key] = expandEnvVars(value);
  }
  return expanded;
}

/**
 * Expand `${VAR}` and `$VAR` references in every string-valued environment
 * variable passed to a stdio server, so that secrets can be referenced from the
 * host environment instead of being hardcoded in `mcp.json`.
 */
function expandEnvValues(env: Record<string, unknown>): Record<string, string> {
  const expanded: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') expanded[key] = expandEnvVars(value);
  }
  return expanded;
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
      new URL(expandEnvVars(obj.url as string));
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
        env:
          typeof e.env === 'object' && e.env !== null ? expandEnvValues(e.env as Record<string, unknown>) : undefined,
      };
    } else if (classification.kind === 'http') {
      const e = entry as Record<string, unknown>;
      const oauthResult = parseOAuthConfig(e.oauth);
      if (oauthResult.reason) {
        skippedServers.push({ name, reason: oauthResult.reason });
        continue;
      }
      servers[name] = {
        url: expandEnvVars(e.url as string),
        headers:
          typeof e.headers === 'object' && e.headers !== null
            ? expandHeaderEnvVars(e.headers as Record<string, unknown>)
            : undefined,
        oauth: oauthResult.config,
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

function parseOAuthConfig(raw: unknown): { config?: McpHttpOAuthConfig; reason?: string } {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object') {
    return { reason: 'Invalid OAuth config: expected an object' };
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.redirectUrl !== 'string') {
    return { reason: 'Invalid OAuth config: missing required field "redirectUrl"' };
  }
  try {
    const redirectUrl = new URL(obj.redirectUrl);
    const isLoopback =
      redirectUrl.hostname === 'localhost' ||
      redirectUrl.hostname.startsWith('127.') ||
      redirectUrl.hostname === '[::1]';
    if (redirectUrl.protocol !== 'https:' && !(redirectUrl.protocol === 'http:' && isLoopback)) {
      return { reason: 'Invalid OAuth redirectUrl: must use HTTPS unless it is a loopback HTTP URL' };
    }
  } catch {
    return { reason: `Invalid OAuth redirectUrl: "${obj.redirectUrl}"` };
  }

  if (obj.scopes !== undefined && (!Array.isArray(obj.scopes) || obj.scopes.some(scope => typeof scope !== 'string'))) {
    return { reason: 'Invalid OAuth config: "scopes" must be an array of strings' };
  }

  return {
    config: {
      redirectUrl: obj.redirectUrl,
      clientName: typeof obj.clientName === 'string' ? obj.clientName : undefined,
      scopes: obj.scopes as string[] | undefined,
      clientId: typeof obj.clientId === 'string' ? obj.clientId : undefined,
      clientSecret: typeof obj.clientSecret === 'string' ? obj.clientSecret : undefined,
    },
  };
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
