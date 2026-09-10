import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { z } from 'zod';

import { auditAgentName } from '../storage/domains/audit/base.js';
import type { AuditActorType } from '../storage/domains/audit/base.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';

export const FACTORY_OPEN_RUNS_SETTING = 'factoryOpenRuns';

const factoryOpenRunSchema = z.object({
  kickoffId: z.string(),
  bindingId: z.string(),
  role: z.string(),
  startedBy: z.string(),
  orgId: z.string(),
  factoryProjectId: z.string(),
  workItemId: z.string(),
  workItemName: z.string().optional(),
  sessionId: z.string(),
  threadId: z.string(),
  branch: z.string(),
  agentName: z.string(),
});

export type FactoryOpenRun = z.infer<typeof factoryOpenRunSchema>;

export interface RunEndCaptureSession {
  readonly thread: {
    getSetting(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<void>;
  };
  readonly mode: { get(): string };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];
const pendingWrites = new WeakMap<RunEndCaptureSession, Promise<void>>();

function serializeRunAudit(session: RunEndCaptureSession, write: () => Promise<void>): Promise<void> {
  const pending = (pendingWrites.get(session) ?? Promise.resolve())
    .then(write)
    .catch(error => console.warn('[Factory run audit] Unable to record run lifecycle.', error));
  pendingWrites.set(session, pending);
  return pending;
}

async function readOpenRuns(session: RunEndCaptureSession): Promise<FactoryOpenRun[]> {
  const stored = await session.thread.getSetting({ key: FACTORY_OPEN_RUNS_SETTING });
  return z.array(factoryOpenRunSchema).parse(stored ?? []);
}

function runAuditInput(run: FactoryOpenRun) {
  const { orgId, factoryProjectId, workItemId, workItemName, ...metadata } = run;
  return {
    orgId,
    factoryProjectId,
    idempotencyKey: run.kickoffId,
    targets: [{ type: 'work_item', id: workItemId, ...(workItemName ? { name: workItemName } : {}) }],
    metadata,
  };
}

async function recordRunEnds(
  session: RunEndCaptureSession,
  audit: AuditRecorder,
  reason: RunEndReason,
  kickoffId?: string,
): Promise<void> {
  if (!reason || reason === 'suspended') return;
  const runs = await readOpenRuns(session);
  if (runs.length === 0) return;
  const remaining = [];
  for (const run of runs) {
    if (kickoffId && run.kickoffId !== kickoffId) {
      remaining.push(run);
      continue;
    }
    const input = runAuditInput(run);
    const recorded = await audit.record({
      ...input,
      actorId: `agent:${run.threadId}`,
      actorType: 'agent',
      action: 'factory.run.ended',
      metadata: { ...input.metadata, reason },
    });
    if (!recorded) remaining.push(run);
  }
  await session.thread.setSetting({ key: FACTORY_OPEN_RUNS_SETTING, value: remaining });
}

export function recordSessionRunStart(
  session: RunEndCaptureSession,
  {
    audit,
    run,
    actorType,
    observedEnd,
  }: {
    audit: AuditRecorder;
    run: Omit<FactoryOpenRun, 'agentName'>;
    actorType: AuditActorType;
    observedEnd: () => RunEndReason;
  },
): Promise<void> {
  const openRun = { ...run, agentName: auditAgentName(session.mode.get()) };
  return serializeRunAudit(session, async () => {
    const runs = await readOpenRuns(session);
    if (!runs.some(existing => existing.kickoffId === run.kickoffId)) {
      await session.thread.setSetting({ key: FACTORY_OPEN_RUNS_SETTING, value: [...runs, openRun] });
    }
    await audit.record({
      ...runAuditInput(openRun),
      actorId: run.startedBy,
      actorType,
      action: 'factory.run.started',
    });
    await recordRunEnds(session, audit, observedEnd(), run.kickoffId);
  });
}

export function observeSessionRunEnd(session: RunEndCaptureSession, { audit }: { audit: AuditRecorder }): () => void {
  return session.subscribe(event => {
    if (event.type !== 'agent_end' || !event.reason || event.reason === 'suspended') return;
    void serializeRunAudit(session, () => recordRunEnds(session, audit, event.reason));
  });
}
