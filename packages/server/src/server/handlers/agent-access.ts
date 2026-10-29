import type { Agent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { HTTPException } from '../http-exception';
import { assertExecuteAccess, assertReadAccess } from './authorship';
import type { OwnedRecord } from './authorship';

/**
 * Stored agents are owner/visibility scoped like `/stored/agents`: a caller without `access` gets the same 404 as for
 * a missing agent. Once hydrated, the editor registers stored agents on Mastra (source `'stored'`), so this applies to
 * agents found through `mastra.getAgentById`/`listAgents` as well. Their raw config is the storage record, which
 * carries authorId/visibility. Code agents (including ones with stored overrides) are visible to every caller.
 */
export function assertStoredAgentAccess({
  agent,
  agentId,
  requestContext,
  access,
}: {
  agent: Pick<Agent, 'source' | 'toRawConfig'>;
  agentId: string;
  requestContext: RequestContext | undefined;
  access: 'read' | 'execute';
}): void {
  if (!requestContext || agent.source !== 'stored') return;
  const record = (agent.toRawConfig() ?? {}) as OwnedRecord;
  const assertAccess = access === 'read' ? assertReadAccess : assertExecuteAccess;
  assertAccess({ requestContext, resource: 'stored-agents', resourceId: agentId, record });
}

/** `mastra.listAgents()` without the hydrated stored agents the caller can't read. */
export function listAgentsVisibleTo<TAgent extends Pick<Agent, 'source' | 'toRawConfig'>>(
  agents: Record<string, TAgent> | undefined,
  requestContext: RequestContext | undefined,
): Record<string, TAgent> {
  return Object.fromEntries(
    Object.entries(agents ?? {}).filter(([id, agent]) => {
      try {
        assertStoredAgentAccess({ agent, agentId: id, requestContext, access: 'read' });
        return true;
      } catch (error) {
        if (error instanceof HTTPException) return false;
        throw error;
      }
    }),
  );
}
