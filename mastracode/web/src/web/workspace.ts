import path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { MASTRACODE_WORKSPACE_TOOLS } from '@mastra/code-sdk/workspace-tools';
import { mintInstallationToken } from './github/client.js';
import { ensureRepoCheckout, reattachProjectSandbox } from './github/sandbox.js';
import { SandboxFilesystem } from './github/sandbox-filesystem.js';

const WORKSPACE_ID_PREFIX = 'mc';

async function getSandboxWorkspace({
  sandboxId,
  workdir,
  repoFullName,
  defaultBranch,
  installationId,
  mastra,
}: {
  sandboxId: string;
  workdir: string;
  repoFullName?: string;
  defaultBranch?: string;
  installationId?: number;
  mastra?: Mastra;
}): Promise<Workspace> {
  const workspaceId = `${WORKSPACE_ID_PREFIX}-${sandboxId}`;

  try {
    const existing = mastra?.getWorkspaceById(workspaceId) as Workspace | undefined;
    if (existing) {
      existing.setToolsConfig(MASTRACODE_WORKSPACE_TOOLS);
      return existing;
    }
  } catch {
    // Not registered yet.
  }

  const sandbox = await reattachProjectSandbox({ sandboxId });
  if (repoFullName && defaultBranch && installationId) {
    // Mint the token here (not at reattach time) so it goes straight to
    // `authenticateGh` inside `ensureRepoCheckout` — the ~1h token stays fresh
    // for the actual git operations rather than being provisioned upfront.
    const token = await mintInstallationToken(installationId);
    await ensureRepoCheckout(sandbox, workdir, { repoFullName, defaultBranch }, token);
  }
  const filesystem = new SandboxFilesystem({ sandbox, workdir });

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

  if (ctx?.session.id && state?.sandboxWorkdir) {
    return getSandboxWorkspace({
      sandboxId: ctx.session.id,
      workdir: state.sandboxWorkdir,
      repoFullName: typeof state.repoFullName === 'string' ? state.repoFullName : undefined,
      defaultBranch: typeof state.defaultBranch === 'string' ? state.defaultBranch : undefined,
      installationId: typeof state.installationId === 'number' ? state.installationId : undefined,
      mastra,
    });
  }

  const rawProjectPath = state?.projectPath;
  if (!rawProjectPath) {
    throw new Error('Project path is required');
  }

  return getLocalFilesystemWorkspace({ projectPath: rawProjectPath, mastra });
}
