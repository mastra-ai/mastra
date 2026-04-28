import { existsSync } from 'node:fs';
import os from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessRequestContext } from '@mastra/core/harness';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import type { LSPConfig } from '@mastra/core/workspace';
import type { z } from 'zod';
import { loadSettings } from '../onboarding/settings.js';
import type { stateSchema } from '../schema';
import { TOOL_NAME_OVERRIDES } from '../tool-names.js';

// =============================================================================
// Sandbox Environment
// =============================================================================

/**
 * Allowlist of env vars to inherit into the sandbox.
 * We avoid spreading all of process.env to prevent secrets from leaking
 * into observability traces and scorer data.
 */
const SANDBOX_ENV_ALLOWLIST = [
  // System essentials
  'PATH',
  'HOME',
  'SHELL',
  'USER',
  'LOGNAME',
  'TMPDIR',
  'TEMP',
  'TMP',
  // Locale
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  // Terminal
  'TERM',
  'COLORTERM',
  'TERM_PROGRAM',
  // Node.js
  'NODE_PATH',
  'NODE_OPTIONS',
  'NODE_ENV',
  // Package managers
  'NPM_CONFIG_PREFIX',
  'NPM_CONFIG_CACHE',
  'PNPM_HOME',
  'YARN_GLOBAL_FOLDER',
  'BUN_INSTALL',
  // Version managers
  'NVM_DIR',
  'FNM_DIR',
  'VOLTA_HOME',
  'N_PREFIX',
  // Build tools
  'CARGO_HOME',
  'GOPATH',
  'GOROOT',
  'RUSTUP_HOME',
  'JAVA_HOME',
  'ANDROID_HOME',
  // Editor
  'EDITOR',
  'VISUAL',
  // Git
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
  // Platform specifics (macOS)
  'XPC_FLAGS',
  'XPC_SERVICE_NAME',
  '__CF_USER_TEXT_ENCODING',
];

function buildSandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  for (const key of SANDBOX_ENV_ALLOWLIST) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }

  // Explicit overrides for non-interactive subprocess execution
  env.FORCE_COLOR = '1';
  env.CLICOLOR_FORCE = '1';
  env.TERM = process.env.TERM || 'xterm-256color';
  env.CI = 'true';
  env.NONINTERACTIVE = '1';
  env.DEBIAN_FRONTEND = 'noninteractive';

  return env;
}

// =============================================================================
// Create Workspace with Skills
// =============================================================================

// We support multiple skill locations for compatibility:
// 1. Project-local: .mastracode/skills (project-specific mastracode skills)
// 2. Project-local: .claude/skills (Claude Code compatible skills)
// 3. Project-local: .agents/skills (Agent Skills spec compatible)
// 4. Global: ~/.mastracode/skills (user-wide mastracode skills)
// 5. Global: ~/.claude/skills (user-wide Claude Code skills)
// 6. Global: ~/.agents/skills (user-wide Agent Skills spec compatible)

const mastraCodeLocalSkillsPath = path.join(process.cwd(), '.mastracode', 'skills');

const claudeLocalSkillsPath = path.join(process.cwd(), '.claude', 'skills');

const agentSkillsLocalPath = path.join(process.cwd(), '.agents', 'skills');

const mastraCodeGlobalSkillsPath = path.join(os.homedir(), '.mastracode', 'skills');

const claudeGlobalSkillsPath = path.join(os.homedir(), '.claude', 'skills');

const agentSkillsGlobalPath = path.join(os.homedir(), '.agents', 'skills');

export const skillPaths = [
  mastraCodeLocalSkillsPath,
  claudeLocalSkillsPath,
  agentSkillsLocalPath,
  mastraCodeGlobalSkillsPath,
  claudeGlobalSkillsPath,
  agentSkillsGlobalPath,
];

export const allowedSkillPaths = skillPaths;

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

type MastraCodeState = z.infer<typeof stateSchema>;

export function getDynamicWorkspace({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) {
  const ctx = requestContext.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();
  const modeId = ctx?.modeId ?? 'build';
  const rawProjectPath = state?.projectPath;

  if (!rawProjectPath) {
    throw new Error('Project path is required');
  }

  const projectPath = path.resolve(rawProjectPath);
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${projectPath}`;
  const sandboxPaths = state?.sandboxAllowedPaths ?? [];
  const allowedPaths = [...allowedSkillPaths, ...sandboxPaths.map((p: string) => path.resolve(p))];
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
      env: buildSandboxEnv(),
    }),
    tools: isPlanMode ? { ...TOOL_NAME_OVERRIDES, ...planModeTools } : TOOL_NAME_OVERRIDES,
    ...(skillPaths.length > 0 ? { skills: skillPaths } : {}),
    lsp: lspConfig,
  });
}

if (skillPaths.length > 0) {
  console.info(`Skills loaded from:`);
  for (const p of skillPaths) {
    console.info(`  - ${p}`);
  }
}
