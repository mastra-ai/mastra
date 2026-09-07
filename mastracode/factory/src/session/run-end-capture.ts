import type { AgentControllerEvent } from '@mastra/core/agent-controller';

import type { AuditRecorder } from '../storage/domains/audit/domain.js';

export interface RunEndCaptureSession {
  readonly identity: { getResourceId(): string };
  readonly thread: { getId(): string | null; getSetting(args: { key: string }): Promise<unknown> };
  readonly state: { get(): Readonly<{ factoryOrgId?: string; factoryProjectId?: string }> };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

type RunEndReason = NonNullable<Extract<AgentControllerEvent, { type: 'agent_end' }>['reason']>;

async function recordRunEnd(session: RunEndCaptureSession, audit: AuditRecorder, reason: RunEndReason): Promise<void> {
  const workItemId = await session.thread.getSetting({ key: 'factoryWorkItemId' });
  const { factoryOrgId, factoryProjectId } = session.state.get();
  const threadId = session.thread.getId();
  if (typeof workItemId !== 'string' || !factoryOrgId || !factoryProjectId || !threadId) return;
  await audit.record({
    orgId: factoryOrgId,
    factoryProjectId,
    actorId: `agent:${threadId}`,
    actorType: 'agent',
    action: 'factory.run.ended',
    targets: [{ type: 'work_item', id: workItemId }],
    metadata: { reason, sessionId: session.identity.getResourceId(), threadId },
  });
}

/** A suspended run is parked, not over: it resumes and ends later under its own `agent_end`. */
export function observeSessionRunEnd(session: RunEndCaptureSession, { audit }: { audit: AuditRecorder }): () => void {
  return session.subscribe(event => {
    if (event.type !== 'agent_end' || !event.reason || event.reason === 'suspended') return;
    void recordRunEnd(session, audit, event.reason).catch(error =>
      console.warn('[Factory run-end capture] Unable to record run end.', error),
    );
  });
}
