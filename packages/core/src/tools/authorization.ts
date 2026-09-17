import { MastraFGAPermissions } from '../auth/ee';
import type { ActorSignal, IFGAProvider } from '../auth/ee';
import type { RequestContext } from '../request-context';
import type { McpMetadata } from './types';

export type ToolAuthorizationOrigin =
  | { type: 'agent'; agentId: string }
  | { type: 'mcp'; serverName: string }
  | { type: 'standalone' };

interface ToolAuthorizationMetadata {
  agentId?: string;
  agentName?: string;
  runId?: string;
  threadId?: string;
  mcpMetadata?: McpMetadata;
}

interface AuthorizeToolExecutionOptions {
  mastra?: unknown;
  origin: ToolAuthorizationOrigin;
  toolName: string;
  requestContext?: RequestContext;
  user?: unknown;
  actor?: ActorSignal;
  executionResourceId?: string;
  metadata?: ToolAuthorizationMetadata;
}

/** Enforce the shared FGA policy for direct and nested tool execution. */
export async function authorizeToolExecution({
  mastra,
  origin,
  toolName,
  requestContext,
  user,
  actor,
  executionResourceId,
  metadata,
}: AuthorizeToolExecutionOptions): Promise<void> {
  const fgaProvider = (mastra as { getServer?: () => { fga?: IFGAProvider } })?.getServer?.()?.fga;
  if (!fgaProvider) {
    return;
  }

  const { getAgentToolFGAResourceId, getMCPToolFGAResourceId, getStandaloneToolFGAResourceId, requireFGA } =
    await import('../auth/ee/fga-check');

  const toolResourceId =
    origin.type === 'mcp'
      ? getMCPToolFGAResourceId(origin.serverName, toolName)
      : origin.type === 'agent'
        ? getAgentToolFGAResourceId(origin.agentId, toolName)
        : getStandaloneToolFGAResourceId(toolName);

  await requireFGA({
    fgaProvider,
    user,
    resource: { type: 'tool', id: toolResourceId },
    permission: MastraFGAPermissions.TOOLS_EXECUTE,
    requestContext,
    actor,
    context: {
      resourceId: executionResourceId,
    },
    metadata: {
      toolName,
      agentId: metadata?.agentId,
      agentName: metadata?.agentName,
      runId: metadata?.runId,
      threadId: metadata?.threadId,
      executionResourceId,
      mcpMetadata: metadata?.mcpMetadata,
    },
  });
}
