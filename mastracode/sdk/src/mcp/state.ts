/**
 * Persisted MCP disable state — mastracode-owned so user config files
 * (mcp.json, .mcp.json, .claude/settings.local.json) are never mutated.
 *
 * Stored as a single JSON file in the app data dir, with a global section
 * (applies to every project) and per-project entries:
 *
 *   {
 *     "global": { "allDisabled": true, "disabledServers": ["name"] },
 *     "projects": {
 *       "/path/to/project": { "serverOverrides": { "name": "enabled" } }
 *     }
 *   }
 *
 * Project overrides are kept even if the server disappears from config, so a
 * server that is removed and later re-added keeps its explicit project state.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '../utils/project.js';

export type McpProjectServerOverride = 'enabled' | 'disabled';

interface McpStateFile {
  global?: { allDisabled?: boolean; disabledServers?: string[] };
  projects?: Record<string, { serverOverrides?: Record<string, McpProjectServerOverride>; disabledServers?: string[] }>;
}

/** Global (all-projects) MCP disable state. */
export interface McpGlobalDisableState {
  /** When true, every MCP server is disabled regardless of per-server state. */
  allDisabled: boolean;
  /** Server names disabled across all projects. */
  disabledServers: string[];
}

export function getMcpStatePath(): string {
  return join(getAppDataDir(), 'mcp-state.json');
}

function readStateFile(): McpStateFile {
  const filePath = getMcpStatePath();
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    return parsed && typeof parsed === 'object' ? (parsed as McpStateFile) : {};
  } catch {
    return {};
  }
}

function writeStateFile(state: McpStateFile): void {
  const filePath = getMcpStatePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Atomic write (same pattern as FileOAuthStorage) so a crash mid-write
  // never leaves a truncated state file. The temp name is process-unique so
  // two concurrent mastracode processes never share a partially written file.
  const tmpPath = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpPath, filePath);
}

function cleanNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  return names.filter((name): name is string => typeof name === 'string');
}

function cleanProjectOverrides(overrides: unknown): Record<string, McpProjectServerOverride> {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  return Object.fromEntries(
    Object.entries(overrides).filter(
      (entry): entry is [string, McpProjectServerOverride] => entry[1] === 'enabled' || entry[1] === 'disabled',
    ),
  );
}

/** Load project-specific server overrides, migrating legacy disabled names in memory. */
export function loadProjectServerOverrides(projectDir: string): Record<string, McpProjectServerOverride> {
  const project = readStateFile().projects?.[projectDir];
  const overrides = cleanProjectOverrides(project?.serverOverrides);
  for (const name of cleanNames(project?.disabledServers)) {
    overrides[name] ??= 'disabled';
  }
  return overrides;
}

/** Persist project-specific server overrides. */
export function saveProjectServerOverrides(
  projectDir: string,
  serverOverrides: Record<string, McpProjectServerOverride>,
): void {
  const state = readStateFile();
  const projects = state.projects ?? {};
  const sortedOverrides = Object.fromEntries(Object.entries(serverOverrides).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(sortedOverrides).length > 0) {
    projects[projectDir] = { serverOverrides: sortedOverrides };
  } else {
    delete projects[projectDir];
  }
  writeStateFile({ ...state, projects });
}

/** Load the persisted global disable state (applies to all projects). */
export function loadGlobalDisableState(): McpGlobalDisableState {
  const global = readStateFile().global;
  return {
    allDisabled: global?.allDisabled === true,
    disabledServers: cleanNames(global?.disabledServers),
  };
}

/** Persist the global disable state. Prunes the section when empty. */
export function saveGlobalDisableState(globalState: McpGlobalDisableState): void {
  const state = readStateFile();
  if (!globalState.allDisabled && globalState.disabledServers.length === 0) {
    delete state.global;
    writeStateFile(state);
    return;
  }
  writeStateFile({
    ...state,
    global: {
      ...(globalState.allDisabled ? { allDisabled: true } : {}),
      ...(globalState.disabledServers.length > 0 ? { disabledServers: [...globalState.disabledServers].sort() } : {}),
    },
  });
}
