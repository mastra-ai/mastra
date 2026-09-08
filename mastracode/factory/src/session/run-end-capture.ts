import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { z } from 'zod';

import { auditAgentName } from '../storage/domains/audit/base.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';

/** Written by the coordinator per kickoff, consumed by the first `agent_end` that is not a suspension. */
export const FACTORY_OPEN_RUN_SETTING = 'factoryOpenRun';

const factoryOpenRunSchema = z.object({ bindingId: z.string(), role: z.string(), startedBy: z.string() });

export type FactoryOpenRun = z.infer<typeof factoryOpenRunSchema>;

export interface RunEndCaptureSession {
  readonly identity: { getResourceId(): string };
  readonly thread: {
    getId(): string | null;
    getSetting(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<void>;
  };
  readonly mode: { get(): string };
  readonly state: { get(): Readonly<{ factoryOrgId?: string; factoryProjectId?: string }> };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

type RunEndReason = NonNullable<Extract<AgentControllerEvent, { type: 'agent_end' }>['reason']>;

async function recordRunEnd(session: RunEndCaptureSession, audit: AuditRecorder, reason: RunEndReason): Promise<void> {
  const openRun = factoryOpenRunSchema.safeParse(await session.thread.getSetting({ key: FACTORY_OPEN_RUN_SETTING }));
  if (!openRun.success) return;
  const workItemId = await session.thread.getSetting({ key: 'factoryWorkItemId' });
  const { factoryOrgId, factoryProjectId } = session.state.get();
  const threadId = session.thread.getId();
  if (typeof workItemId !== 'string' || !factoryOrgId || !factoryProjectId || !threadId) return;
  await session.thread.setSetting({ key: FACTORY_OPEN_RUN_SETTING, value: null });
  await audit.record({
    orgId: factoryOrgId,
    factoryProjectId,
    actorId: `agent:${threadId}`,
    actorType: 'agent',
    action: 'factory.run.ended',
    targets: [{ type: 'work_item', id: workItemId }],
    metadata: {
      reason,
      ...openRun.data,
      agentName: auditAgentName(session.mode.get()),
      sessionId: session.identity.getResourceId(),
      threadId,
    },
  });
}

/** A suspended run is parked, not over: it resumes and ends later under its own `agent_end`. */
export function observeSessionRunEnd(session: RunEndCaptureSession, { audit }: { audit: AuditRecorder }): () => void {
  // Terminal events arriving together would otherwise each read the open run
  // before the first one clears it, closing the same run twice.
  let pending: Promise<void> = Promise.resolve();
  return session.subscribe(event => {
    if (event.type !== 'agent_end' || !event.reason || event.reason === 'suspended') return;
    const reason = event.reason;
    pending = pending
      .then(() => recordRunEnd(session, audit, reason))
      .catch(error => console.warn('[Factory run-end capture] Unable to record run end.', error));
  });
}
