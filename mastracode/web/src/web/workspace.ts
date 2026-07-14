import path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { MASTRACODE_WORKSPACE_TOOLS } from '@mastra/code-sdk/workspace-tools';
import { reattachProjectSandbox } from './github/sandbox.js';
import { SandboxFilesystem } from './github/sandbox-filesystem.js';

const WORKSPACE_ID_PREFIX = 'mastra-code-workspace';

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
  const boundWorkdir = worktreePath || workdir;
  const workspaceId = `${WORKSPACE_ID_PREFIX}-gh-${githubProjectId}-${sandboxId}-${boundWorkdir}`;

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

function getLocalFilesystemWorkspace({ projectPath, mastra }: { projectPath: string; mastra?: Mastra }): Workspace {
  const resolvedProjectPath = path.resolve(projectPath);
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${resolvedProjectPath}`;

  try {
    const existing = mastra?.getWorkspaceById(workspaceId) as Workspace | undefined;
    if (existing) {
      existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
      return existing;
    }
  } catch {
    // Not registered yet.
  }

  return new Workspace({
    id: workspaceId,
    name: 'Mastra Code Filesystem Workspace',
    filesystem: new LocalFilesystem({ basePath: resolvedProjectPath }),
    tools: MASTRACODE_WORKSPACE_TOOLS,
  });
}

export async function getWebWorkspace({
  requestContext,
  mastra,
}: {
  requestContext: RequestContext;
  mastra?: Mastra;
}): Promise<Workspace> {
  const ctx = requestContext.get('controller') as AgentControllerRequestContext<MastraCodeState> | undefined;
  const state = ctx?.getState();

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

  return getLocalFilesystemWorkspace({ projectPath: rawProjectPath, mastra });
}
