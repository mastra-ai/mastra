import fs, { existsSync } from 'node:fs';
import os from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolsInput } from '@mastra/core/agent';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import type { LSPConfig } from '@mastra/core/workspace';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadSettings } from '../onboarding/settings.js';
import type { MastraCodeState } from '../schema';
import { getPlansDir } from '../utils/plans.js';
import { detectProject } from '../utils/project.js';
import { MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY } from '../web/git-clone-context.js';
import type { MastraCodeWebGitCloneContext } from '../web/git-clone-context.js';
import { ensureWebGitClone } from '../web/git-clone.js';
import { GOAL_JUDGE_READONLY_TOOLS, MASTRACODE_WORKSPACE_TOOLS } from './tool-availability.js';

// =============================================================================
// Sandbox Environment
// =============================================================================

function buildSandboxEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Explicit overrides for non-interactive subprocess execution
    FORCE_COLOR: '1',
    CLICOLOR_FORCE: '1',
    TERM: process.env.TERM || 'xterm-256color',
    CI: 'true',
    NONINTERACTIVE: '1',
    DEBIAN_FRONTEND: 'noninteractive',
  };
}

// =============================================================================
// Create Workspace with Skills
// =============================================================================

// We support multiple skill locations for compatibility:
// 1. Project-local: <configDir>/skills (project-specific mastracode skills)
// 2. Project-local: .claude/skills (Claude Code compatible skills)
// 3. Project-local: .agents/skills (Agent Skills spec compatible)
// 4. Global: ~/<configDir>/skills (user-wide mastracode skills)
// 5. Global: ~/.claude/skills (user-wide Claude Code skills)
// 6. Global: ~/.agents/skills (user-wide Agent Skills spec compatible)

// Mastra's LocalSkillSource.readdir uses Node's Dirent.isDirectory() which
// returns false for symlinks. Tools like `npx skills add` install skills as
// symlinks, so we need to resolve them. For each symlinked skill directory,
// we add the real (resolved) parent path as an additional skill scan path.
function collectSkillPaths(skillsDirs: string[]): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  for (const skillsDir of skillsDirs) {
    const resolved = path.resolve(skillsDir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(skillsDir);
    }

    if (!fs.existsSync(skillsDir)) continue;

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          const linkPath = path.join(skillsDir, entry.name);
          const realPath = fs.realpathSync(linkPath);
          const stat = fs.statSync(realPath);
          if (stat.isDirectory()) {
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

// Build skill paths dynamically based on configDir and projectPath
export function buildSkillPaths(projectPath: string, configDir: string, homeDir = os.homedir()): string[] {
  const mastraCodeLocalSkillsPath = path.join(projectPath, configDir, 'skills');
  const claudeLocalSkillsPath = path.join(projectPath, '.claude', 'skills');
  const agentSkillsLocalPath = path.join(projectPath, '.agents', 'skills');
  const mastraCodeGlobalSkillsPath = path.join(homeDir, configDir, 'skills');
  const claudeGlobalSkillsPath = path.join(homeDir, '.claude', 'skills');
  const agentSkillsGlobalPath = path.join(homeDir, '.agents', 'skills');

  return collectSkillPaths([
    mastraCodeLocalSkillsPath,
    claudeLocalSkillsPath,
    agentSkillsLocalPath,
    mastraCodeGlobalSkillsPath,
    claudeGlobalSkillsPath,
    agentSkillsGlobalPath,
  ]);
}

/**
 * Paths the agent is always allowed to access (in addition to the project root
 * and any per-thread sandboxAllowedPaths). The OS temp directory is included
 * so the agent can use it as a scratchpad without requesting access every time.
 */
const DEFAULT_ALLOWED_PATHS: string[] = [os.tmpdir(), '/tmp', getPlansDir()].reduce<string[]>((acc, p) => {
  const resolved = path.resolve(p);
  if (!acc.includes(resolved)) acc.push(resolved);
  return acc;
}, []);

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

function getGitCloneContext(requestContext: RequestContext): MastraCodeWebGitCloneContext | undefined {
  const value = requestContext.get(MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY);
  if (!value || typeof value !== 'object') return undefined;

  const gitUrl = (value as { gitUrl?: unknown }).gitUrl;
  const cloneParentPath = (value as { cloneParentPath?: unknown }).cloneParentPath;
  if (typeof gitUrl !== 'string') return undefined;
  return typeof cloneParentPath === 'string' ? { gitUrl, cloneParentPath } : { gitUrl };
}

export async function getDynamicWorkspace({
  requestContext,
  mastra,
}: {
  requestContext: RequestContext;
  mastra?: Mastra;
}) {
  const ctx = requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();
  const gitClone = getGitCloneContext(requestContext);
  let rawProjectPath = state?.projectPath;

  if (gitClone) {
    rawProjectPath = await ensureWebGitClone(gitClone.gitUrl, gitClone.cloneParentPath);
    try {
      const project = detectProject(rawProjectPath);
      await ctx?.setState({
        projectPath: project.rootPath,
        projectName: project.name,
        gitBranch: project.gitBranch,
      });
      rawProjectPath = project.rootPath;
    } catch {
      await ctx?.setState({ projectPath: rawProjectPath, projectName: path.basename(rawProjectPath) });
    }
  }

  if (!rawProjectPath) {
    throw new Error('Project path is required');
  }

  const projectPath = path.resolve(rawProjectPath);
  const configDir = state?.configDir ?? DEFAULT_CONFIG_DIR;
  const skillPaths = buildSkillPaths(projectPath, configDir, state?.homeDir);
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectPath}`;
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];
  const allowedPaths = [...skillPaths, ...DEFAULT_ALLOWED_PATHS, ...sandboxPaths.map((p: string) => path.resolve(p))];

  // All modes share the same workspace tool configuration.  Per-mode tool
  // visibility is enforced at LLM-call time via `availableTools` /
  // `activeTools` on the Harness, not by mutating workspace capabilities.
  const workspaceTools = MASTRACODE_WORKSPACE_TOOLS;

  // Reuse existing workspace if already registered (preserves ProcessManager state)
  let existing: Workspace<LocalFilesystem, LocalSandbox> | undefined;
  try {
    existing = mastra?.getWorkspaceById(workspaceId) as Workspace<LocalFilesystem, LocalSandbox>;
  } catch {
    // Not registered yet
  }

  if (existing) {
    existing.filesystem.setAllowedPaths(allowedPaths);
    existing.setToolsConfig(workspaceTools);
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
      env: buildSandboxEnv(),
    }),
    tools: workspaceTools,
    ...(skillPaths.length > 0 ? { skills: skillPaths } : {}),
    lsp: lspConfig,
  });
}

/**
 * Resolver for the agent's `goal.tools` config. Builds the request's workspace
 * (same per-request resolution as the agent's own tools) and returns only the
 * read-only verification subset, remapped to mastracode's tool names (`view`,
 * `search_content`, etc.). Returns `undefined` when no workspace can be resolved
 * (e.g. no project path), keeping the default judge text-only rather than
 * throwing inside the goal step.
 */
export async function getGoalJudgeTools({
  requestContext,
  mastra,
}: {
  requestContext: RequestContext;
  mastra?: Mastra;
}): Promise<ToolsInput | undefined> {
  let workspace: Workspace<LocalFilesystem, LocalSandbox>;
  try {
    workspace = await getDynamicWorkspace({ requestContext, mastra });
  } catch {
    return undefined;
  }

  const allTools = await createWorkspaceTools(workspace, { requestContext, workspace });
  const readonly: ToolsInput = {};
  for (const name of GOAL_JUDGE_READONLY_TOOLS) {
    if (allTools[name]) readonly[name] = allTools[name];
  }
  return Object.keys(readonly).length > 0 ? readonly : undefined;
}
