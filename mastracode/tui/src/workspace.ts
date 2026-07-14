import fs, { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path, { dirname, join } from 'node:path';
import { DEFAULT_CONFIG_DIR } from '@mastra/code-sdk/constants';
import { loadSettings } from '@mastra/code-sdk/onboarding/settings';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { isPathWithinRoot } from '@mastra/code-sdk/utils/path-security';
import { getPlansDir } from '@mastra/code-sdk/utils/plans';
import { MASTRACODE_WORKSPACE_TOOLS } from '@mastra/code-sdk/workspace-tools';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import type { LSPConfig } from '@mastra/core/workspace';

function buildSandboxEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    FORCE_COLOR: '1',
    CLICOLOR_FORCE: '1',
    TERM: process.env.TERM || 'xterm-256color',
    CI: 'true',
    NONINTERACTIVE: '1',
    DEBIAN_FRONTEND: 'noninteractive',
  };
}

function collectSkillPaths(skillsDirs: string[], allowedRoot?: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  let realAllowedRoot: string | undefined;

  if (allowedRoot) {
    try {
      realAllowedRoot = fs.realpathSync(allowedRoot);
    } catch {
      return [];
    }
  }

  for (const skillsDir of skillsDirs) {
    const skillsDirExists = fs.existsSync(skillsDir);
    if (skillsDirExists && realAllowedRoot) {
      try {
        const realSkillsDir = fs.realpathSync(skillsDir);
        if (!isPathWithinRoot(realSkillsDir, realAllowedRoot)) continue;
      } catch {
        continue;
      }
    }

    const resolved = path.resolve(skillsDir);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(skillsDir);
    }

    if (!skillsDirExists) continue;

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) {
          try {
            const linkPath = path.join(skillsDir, entry.name);
            const realPath = fs.realpathSync(linkPath);
            if (realAllowedRoot && !isPathWithinRoot(realPath, realAllowedRoot)) continue;
            const stat = fs.statSync(realPath);
            if (stat.isDirectory()) {
              const realParent = path.dirname(realPath);
              if (realAllowedRoot && !isPathWithinRoot(realParent, realAllowedRoot)) continue;
              if (!seen.has(realParent)) {
                seen.add(realParent);
                paths.push(realParent);
              }
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Ignore errors during symlink resolution.
    }
  }

  return paths;
}

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

  const paths = [
    ...collectSkillPaths([mastraCodeLocalSkillsPath, claudeLocalSkillsPath, agentSkillsLocalPath], projectPath),
    ...collectSkillPaths([mastraCodeGlobalSkillsPath, claudeGlobalSkillsPath, agentSkillsGlobalPath]),
    ...pluginSkillPaths.flatMap(pluginSkillPath => collectSkillPaths([pluginSkillPath], pluginSkillPath)),
  ];

  const seenPaths = new Set<string>();
  return paths.filter(skillPath => {
    let resolved: string;
    try {
      resolved = fs.realpathSync(skillPath);
    } catch {
      resolved = path.resolve(skillPath);
    }
    if (seenPaths.has(resolved)) return false;
    seenPaths.add(resolved);
    return true;
  });
}

const DEFAULT_ALLOWED_PATHS: string[] = [os.tmpdir(), '/tmp', getPlansDir()].reduce<string[]>((acc, p) => {
  const resolved = path.resolve(p);
  if (!acc.includes(resolved)) acc.push(resolved);
  return acc;
}, []);

const WORKSPACE_ID_PREFIX = 'mastra-code-workspace';
const require = createRequire(import.meta.url);

function detectPackageRunner(projectPath: string): string | undefined {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm dlx';
  if (existsSync(join(projectPath, 'bun.lockb')) || existsSync(join(projectPath, 'bun.lock'))) return 'bunx';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn dlx';
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npx --yes';
  return 'npx --yes';
}

function getCodeSdkModulePath(): string {
  return dirname(require.resolve('@mastra/code-sdk/package.json'));
}

export async function getTuiWorkspace({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) {
  const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();
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

  let existing: Workspace<LocalFilesystem, LocalSandbox> | undefined;
  try {
    existing = mastra?.getWorkspaceById(workspaceId) as Workspace<LocalFilesystem, LocalSandbox>;
  } catch {
    // Not registered yet.
  }

  if (existing) {
    existing.filesystem.setAllowedPaths(allowedPaths);
    existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
    return existing;
  }

  const userLsp = loadSettings().lsp ?? {};
  const lspConfig: LSPConfig = {
    ...userLsp,
    packageRunner: userLsp.packageRunner || detectPackageRunner(projectPath),
    searchPaths: [getCodeSdkModulePath(), ...(userLsp.searchPaths ?? [])],
  };

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
    tools: MASTRACODE_WORKSPACE_TOOLS,
    ...(skillPaths.length > 0 ? { skills: skillPaths } : {}),
    lsp: lspConfig,
  });
}
