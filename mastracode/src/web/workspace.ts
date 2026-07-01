import crypto from 'node:crypto';
import path from 'node:path';

import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { LocalSandbox } from '@mastra/core/workspace';
import { RailwaySandbox } from '@mastra/railway';
import type { RailwaySandboxOptions } from '@mastra/railway';

import { buildSandboxEnv, createMastraCodeWorkspace } from '../agents/workspace.js';
import type { MastraCodeWorkspaceFactory, MastraCodeWorkspaceFactoryArgs } from '../agents/workspace.js';
import type { MastraCodeState } from '../schema.js';
import { detectProject } from '../utils/project.js';

import {
  getWebGitCloneDirectoryName,
  getWebGitRepoName,
  MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY,
  normalizeWebGitUrl,
} from './git-clone-context.js';
import type { MastraCodeWebGitCloneContext } from './git-clone-context.js';
import { ensureWebGitClone } from './git-clone.js';
import { RailwayFilesystem } from './railway-filesystem.js';

const RAILWAY_WORKSPACE_ROOT = '/workspace';

type RailwayTemplateFactory = Extract<NonNullable<RailwaySandboxOptions['template']>, (template: any) => any>;
type RailwayTemplateBuilder = Parameters<RailwayTemplateFactory>[0];

/**
 * Railway sandbox credentials for web workspaces. When provided, web sessions
 * provision Railway sandboxes instead of local ones. Falls back to the
 * `RAILWAY_API_TOKEN` / `RAILWAY_ENVIRONMENT_ID` env vars when omitted.
 */
export interface MastraCodeRailwayConfig {
  /** Railway account API token. Falls back to `RAILWAY_API_TOKEN`. */
  token?: string;
  /** Railway environment ID. Falls back to `RAILWAY_ENVIRONMENT_ID`. */
  environmentId?: string;
}

export function createWebWorkspaceFactory(railway?: MastraCodeRailwayConfig): MastraCodeWorkspaceFactory {
  return args => getWebWorkspace(args, railway);
}

export function getWebGitCloneContext(requestContext: RequestContext): MastraCodeWebGitCloneContext | undefined {
  const value = requestContext.get(MASTRACODE_WEB_GIT_CLONE_CONTEXT_KEY);
  if (!value || typeof value !== 'object') return undefined;

  const gitUrl = (value as { gitUrl?: unknown }).gitUrl;
  const cloneParentPath = (value as { cloneParentPath?: unknown }).cloneParentPath;
  if (typeof gitUrl !== 'string') return undefined;
  return typeof cloneParentPath === 'string' ? { gitUrl, cloneParentPath } : { gitUrl };
}

export async function getWebWorkspace(
  { requestContext, mastra }: MastraCodeWorkspaceFactoryArgs,
  railway?: MastraCodeRailwayConfig,
) {
  const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();
  const gitClone = getWebGitCloneContext(requestContext);

  const railwayEnvironmentId = railway?.environmentId ?? process.env.RAILWAY_ENVIRONMENT_ID;

  if (railwayEnvironmentId) {
    const projectPath = getRailwayProjectPath(gitClone, state?.projectPath);
    const sandbox = createRailwaySandbox({
      gitClone,
      workdir: projectPath,
      railway: { ...railway, sandboxId: state?.sandboxId as string | undefined },
    });
    const filesystem = new RailwayFilesystem({ sandbox, basePath: projectPath });

    if (gitClone) {
      await ctx?.setState({ projectPath, projectName: getWebGitRepoName(gitClone.gitUrl), gitBranch: 'main' });
    }

    const workspace = await createMastraCodeWorkspace({
      requestContext,
      mastra,
      projectPath,
      filesystem,
      sandbox,
      prepare: async () => {
        await sandbox.start();
        await filesystem._init();
      },
    });

    await workspace.init();

    await ctx?.setState({ sandboxId: sandbox.railway.id });

    return workspace;
  }

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
  return createMastraCodeWorkspace({
    requestContext,
    mastra,
    projectPath,
    sandbox: new LocalSandbox({
      workingDirectory: projectPath,
      env: buildSandboxEnv(),
    }),
  });
}

function createRailwaySandbox({
  gitClone,
  workdir,
  railway,
}: {
  gitClone: MastraCodeWebGitCloneContext | undefined;
  workdir: string;
  railway?: MastraCodeRailwayConfig & { sandboxId?: string };
}): RailwaySandbox {
  const normalizedGitUrl = gitClone ? normalizeWebGitUrl(gitClone.gitUrl) : undefined;
  const checkpointName = normalizedGitUrl ? getRailwayCheckpointName(normalizedGitUrl) : undefined;

  return new RailwaySandbox({
    sandboxId: railway?.sandboxId,
    checkpointName,
    token: railway?.token,
    environmentId: railway?.environmentId,
    idleTimeoutMinutes: 3,
    template: (template: RailwayTemplateBuilder) => {
      let configured = template.workdir(workdir).withPackages('git', 'curl').run('npm i -g pnpm');
      if (normalizedGitUrl) {
        configured = configured.run(`git clone --depth 1 ${shellQuote(normalizedGitUrl)} ${shellQuote(workdir)}`);
      }

      return configured;
    },
  });
}

function getRailwayProjectPath(
  gitClone: MastraCodeWebGitCloneContext | undefined,
  stateProjectPath: string | undefined,
): string {
  if (gitClone) return getRailwayWorkdir(gitClone);
  if (stateProjectPath?.startsWith(`${RAILWAY_WORKSPACE_ROOT}/`) || stateProjectPath === RAILWAY_WORKSPACE_ROOT) {
    return stateProjectPath;
  }
  return RAILWAY_WORKSPACE_ROOT;
}

function getRailwayWorkdir(gitClone: MastraCodeWebGitCloneContext): string {
  return path.posix.join(RAILWAY_WORKSPACE_ROOT, getWebGitCloneDirectoryName(gitClone.gitUrl));
}

function getRailwayCheckpointName(normalizedGitUrl: string): string {
  const repoName =
    getWebGitRepoName(normalizedGitUrl)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'repo';
  const hash = crypto.createHash('sha256').update(normalizedGitUrl).digest('hex').slice(0, 16);
  return `mastracode-${repoName}-${hash}`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
