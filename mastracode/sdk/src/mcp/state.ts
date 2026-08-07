/**
 * Persisted MCP disable state — mastracode-owned so user config files
 * (mcp.json, .mcp.json, .claude/settings.local.json) are never mutated.
 *
 * Stored as a single JSON file in the app data dir, with a global section
 * (applies to every project) and per-project entries:
 *
 *   {
 *     "global": { "allDisabled": true, "disabledServers": ["name"] },
 *     "projects": { "/path/to/project": { "disabledServers": ["name"] } }
 *   }
 *
 * Disabled names are kept even if the server disappears from config, so a
 * server that is removed and later re-added stays disabled until the user
 * re-enables it.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '../utils/project.js';

interface McpStateFile {
  global?: { allDisabled?: boolean; disabledServers?: string[] };
  projects?: Record<string, { disabledServers?: string[] }>;
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

/** Load the persisted disabled server names for a project. */
export function loadDisabledServers(projectDir: string): string[] {
  return cleanNames(readStateFile().projects?.[projectDir]?.disabledServers);
}

/** Persist the disabled server names for a project. */
export function saveDisabledServers(projectDir: string, disabledServers: string[]): void {
  const state = readStateFile();
  const projects = state.projects ?? {};
  if (disabledServers.length > 0) {
    projects[projectDir] = { disabledServers: [...disabledServers].sort() };
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
