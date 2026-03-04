import fs, { existsSync } from 'node:fs';
import os from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import type { LSPConfig } from '@mastra/core/workspace';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadSettings } from '../onboarding/settings.js';
import type { stateSchema } from '../schema';
import { TOOL_NAME_OVERRIDES } from '../tool-names.js';

// =============================================================================
// Create Workspace with Skills
// =============================================================================

// We support multiple skill locations for compatibility:
// 1. Project-local: <configDir>/skills (project-specific mastracode skills)
// 2. Project-local: .claude/skills (Claude Code compatible skills)
// 3. Global: ~/<configDir>/skills (user-wide mastracode skills)
// 4. Global: ~/.claude/skills (user-wide Claude Code skills)

const claudeGlobalSkillsPath = path.join(os.homedir(), '.claude', 'skills');

// Mastra's LocalSkillSource.readdir uses Node's Dirent.isDirectory() which
// returns false for symlinks. Tools like `npx skills add` install skills as
// symlinks, so we need to resolve them. For each symlinked skill directory,
// we add the real (resolved) parent path as an additional skill scan path.
function collectSkillPaths(skillsDirs: string[]): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir)) continue;

    // Always add the directory itself
    const resolved = fs.realpathSync(skillsDir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(skillsDir);
    }

    // Check for symlinked skill subdirectories and add their real parents
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          const linkPath = path.join(skillsDir, entry.name);
          const realPath = fs.realpathSync(linkPath);
          const stat = fs.statSync(realPath);
          if (stat.isDirectory()) {
            // Add the real parent directory as a skill path
            // so Mastra discovers it as a regular directory
            const realParent = path.dirname(realPath);
            if (!seen.has(realParent)) {
              seen.add(realParent);
              paths.push(realParent);
            }
          }
        }
      }
    } catch {
      // Ignore errors during symlink resolution
    }
  }

  return paths;
}

// Claude skill paths that remain static (always use .claude)
const claudeLocalSkillsPath = (projectPath: string) => path.join(projectPath, '.claude', 'skills');

// Build skill paths dynamically based on configDir and projectPath
export function buildSkillPaths(projectPath: string, configDir: string): string[] {
  const mastraCodeLocalSkillsPath = path.join(projectPath, configDir, 'skills');
  const mastraCodeGlobalSkillsPath = path.join(os.homedir(), configDir, 'skills');

  return collectSkillPaths([
    mastraCodeLocalSkillsPath,
    claudeLocalSkillsPath(projectPath),
    mastraCodeGlobalSkillsPath,
    claudeGlobalSkillsPath,
  ]);
}

const WORKSPACE_ID_PREFIX = 'mastra-code-workspace';

/**
 * Detect the project's package runner from lock files.
 * Used as a fallback packageRunner for LSP when no binary is found locally or on PATH.
 */
function detectPackageRunner(projectPath: string): string | undefined {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm dlx';
  if (existsSync(join(projectPath, 'bun.lockb')) || existsSync(join(projectPath, 'bun.lock'))) return 'bunx';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn dlx';
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npx --yes';
  return 'npx --yes';
}

export function getDynamicWorkspace({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) {
  const ctx = requestContext.get('harness') as HarnessRequestContext<typeof stateSchema> | undefined;
  const state = ctx?.getState?.();
  const modeId = ctx?.modeId ?? 'build';
  const rawProjectPath = state?.projectPath;

  if (!rawProjectPath) {
    throw new Error('Project path is required');
  }

  const projectPath = path.resolve(rawProjectPath);
  const configDir = state?.configDir ?? DEFAULT_CONFIG_DIR;
  const skillPaths = buildSkillPaths(projectPath, configDir);
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectPath}`;
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];
  const allowedPaths = [...skillPaths, ...sandboxPaths.map((p: string) => path.resolve(p))];
  const isPlanMode = modeId === 'plan';

  const planModeTools = {
    mastra_workspace_write_file: { ...TOOL_NAME_OVERRIDES.mastra_workspace_write_file, enabled: false },
    mastra_workspace_edit_file: { ...TOOL_NAME_OVERRIDES.mastra_workspace_edit_file, enabled: false },
    mastra_workspace_ast_edit: { ...TOOL_NAME_OVERRIDES.mastra_workspace_ast_edit, enabled: false },
  };

  // Reuse existing workspace if already registered (preserves ProcessManager state)
  let existing: Workspace<LocalFilesystem, LocalSandbox> | undefined;
  try {
    existing = mastra?.getWorkspaceById(workspaceId) as Workspace<LocalFilesystem, LocalSandbox>;
  } catch {
    // Not registered yet
  }

  if (existing) {
    existing.filesystem.setAllowedPaths(allowedPaths);
    existing.setToolsConfig(isPlanMode ? { ...TOOL_NAME_OVERRIDES, ...planModeTools } : TOOL_NAME_OVERRIDES);
    return existing;
  }

  const userLsp = loadSettings().lsp ?? {};
  const mcModulePath = join(dirname(fileURLToPath(import.meta.url)), '..');
  const lspConfig: LSPConfig = {
    ...userLsp,
    packageRunner: userLsp.packageRunner || detectPackageRunner(projectPath), // Detected runner is the fallback — user's packageRunner always wins
    searchPaths: [mcModulePath, ...(userLsp.searchPaths ?? [])],
  };

  // First call for this project — create the workspace
  return new Workspace({
    id: workspaceId,
    name: 'Mastra Code Workspace',
    filesystem: new LocalFilesystem({
      basePath: projectPath,
      allowedPaths,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: projectPath,
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        CLICOLOR_FORCE: '1',
        TERM: process.env.TERM || 'xterm-256color',
        CI: 'true',
        NONINTERACTIVE: '1',
        DEBIAN_FRONTEND: 'noninteractive',
      },
    }),
    tools: isPlanMode ? { ...TOOL_NAME_OVERRIDES, ...planModeTools } : TOOL_NAME_OVERRIDES,
    ...(skillPaths.length > 0 ? { skills: skillPaths } : {}),
    lsp: lspConfig,
  });
}
