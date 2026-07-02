import fs, { existsSync } from 'node:fs';
import os from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolsInput } from '@mastra/core/agent';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import type { LSPConfig } from '@mastra/core/workspace';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadSettings } from '../onboarding/settings.js';
import type { MastraCodeState } from '../schema';
import { getPlansDir } from '../utils/plans.js';
import { SandboxFilesystem } from '../web/github/sandbox-filesystem.js';
import { reattachProjectSandbox } from '../web/github/sandbox.js';
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
export function buildSkillPaths(
  projectPath: string,
  configDir: string,
  homeDir = os.homedir(),
  pluginSkillPaths: string[] = [],
): string[] {
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
    ...pluginSkillPaths,
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

/**
 * Build (or reuse) a sandbox-backed Workspace for a GitHub project. The sandbox
 * is reattached by its persisted provider id and a `SandboxFilesystem` is layered
 * over the in-sandbox checkout so file tools and command tools share one VM.
 */
async function getSandboxWorkspace({
  githubProjectId,
  sandboxId,
  workdir,
  worktreePath,
  mastra,
}: {
  githubProjectId: string;
  sandboxId: string;
  workdir: string;
  worktreePath?: string;
  mastra?: Mastra;
}): Promise<Workspace> {
  // Bind the workspace to the active worktree when one is set, so file tools and
  // command tools operate inside the feature branch's working tree rather than
  // the base checkout. Falls back to the repo root when no worktree is active.
  const boundWorkdir = worktreePath || workdir;

  // Include the sandbox id *and* worktree path in the reuse key: a new sandbox
  // (e.g. the previous one expired) or a different worktree must each get a
  // fresh Workspace/ProcessManager instead of reusing one bound to a stale
  // sandbox or the wrong working tree.
  const workspaceId = `${WORKSPACE_ID_PREFIX}-gh-${githubProjectId}-${sandboxId}-${boundWorkdir}`;

  // Reuse the existing remote workspace if already registered (preserves the
  // reattached sandbox + ProcessManager state across re-opens).
  try {
    const existing = mastra?.getWorkspaceById(workspaceId) as Workspace | undefined;
    if (existing) {
      existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
      return existing;
    }
  } catch {
    // Not registered yet.
  }

  const sandbox = await reattachProjectSandbox(sandboxId);
  const filesystem = new SandboxFilesystem({ sandbox, workdir: boundWorkdir });

  return new Workspace({
    id: workspaceId,
    name: 'Mastra Code Sandbox Workspace',
    filesystem,
    sandbox: sandbox as unknown as ConstructorParameters<typeof Workspace>[0]['sandbox'],
    tools: MASTRACODE_WORKSPACE_TOOLS,
  });
}

export async function getDynamicWorkspace({
  requestContext,
  mastra,
}: {
  requestContext: RequestContext;
  mastra?: Mastra;
}) {
  const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();

  // GitHub/cloud-sandbox-backed project: the repo lives inside a remote sandbox,
  // not on the server host. Reattach to the already-provisioned + materialized
  // sandbox (the SPA called `.../ensure` first, persisting sandboxId/workdir on
  // controller state) and build a sandbox-backed Workspace. LSP/host skill paths
  // are skipped for these workspaces (follow-up).
  if (state?.githubProjectId && state.sandboxId && state.sandboxWorkdir) {
    return getSandboxWorkspace({
      githubProjectId: state.githubProjectId,
      sandboxId: state.sandboxId,
      workdir: state.sandboxWorkdir,
      worktreePath: state.worktreePath,
      mastra,
    });
  }

  const rawProjectPath = state?.projectPath;

  if (!rawProjectPath) {
    throw new Error('Project path is required');
  }

  const projectPath = path.resolve(rawProjectPath);
  const configDir = state?.configDir ?? DEFAULT_CONFIG_DIR;
  const skillPaths = buildSkillPaths(projectPath, configDir, state?.homeDir, state?.pluginSkillPaths ?? []);
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectPath}`;
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];
  const allowedPaths = [...skillPaths, ...DEFAULT_ALLOWED_PATHS, ...sandboxPaths.map((p: string) => path.resolve(p))];

  // All modes share the same workspace tool configuration.  Per-mode tool
  // visibility is enforced at LLM-call time via `availableTools` /
  // `activeTools` on the AgentController, not by mutating workspace capabilities.
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
  let workspace: Workspace;
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
