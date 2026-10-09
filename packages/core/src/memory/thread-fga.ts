import { MastraFGAPermissions } from '../auth/ee';
import type { ActorSignal, MastraFGAPermissionInput } from '../auth/ee';
import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';

export interface CheckThreadFGAOptions {
  mastra?: Mastra;
  user?: Record<string, unknown>;
  threadId: string;
  resourceId?: string;
  agentId?: string;
  requestContext?: RequestContext;
  permission?: MastraFGAPermissionInput;
  actor?: ActorSignal;
}

export async function checkThreadFGA({
  mastra,
  user,
  threadId,
  resourceId,
  agentId,
  requestContext,
  permission = MastraFGAPermissions.MEMORY_READ,
  actor,
}: CheckThreadFGAOptions): Promise<void> {
  const fgaProvider = mastra?.getServer()?.fga;
  if (!fgaProvider) return;

  const { requireFGA } = await import('../auth/ee/fga-check');
  await requireFGA({
    fgaProvider,
    user,
    resource: { type: 'thread', id: threadId },
    permission,
    requestContext,
    actor,
    context:
      resourceId || requestContext
        ? {
            resourceId,
          }
        : undefined,
    metadata: {
      threadId,
      resourceId,
      agentId,
    },
  });
}
