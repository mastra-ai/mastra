/**
 * Harness v1 — canonical Task / Run / Evidence contracts.
 *
 * These are type-only public contracts. The tests use small structural
 * fixtures to pin field names and alias compatibility without adding
 * runtime behavior.
 */

import { describe, expect, it } from 'vitest';

import type {
  HarnessOperationAdmissionEvidence,
  InboxResponseReceipt,
  OperationAdmissionEvidence,
  PendingResume,
  QueueAdmissionReceipt,
  WorkspaceActionJournalEntry,
} from '../../storage/domains/harness/types';
import type {
  HarnessAdmissionEvidence,
  HarnessEvidence,
  HarnessEvidenceKind,
  HarnessRun,
  HarnessRunFinishReason,
  HarnessTaskIndexEntry,
  HarnessTask,
  HarnessTaskOrigin,
  HarnessTaskStatus,
  PendingInteraction,
} from './contracts';
import type {
  HarnessAdmissionEvidence as ExportedHarnessAdmissionEvidence,
  HarnessEvidence as ExportedHarnessEvidence,
  HarnessTask as ExportedHarnessTask,
  PendingInteraction as ExportedPendingInteraction,
} from './index';

describe('Harness v1 canonical contracts', () => {
  it('HarnessTask carries the documented field set', () => {
    const task: HarnessTask = {
      taskId: 'task-1',
      origin: 'user',
      sessionId: 'sess-1',
      resourceId: 'r-1',
      threadId: 't-1',
      createdAt: 0,
      status: 'pending',
    };

    expect(task).toMatchObject({
      taskId: 'task-1',
      origin: 'user',
      sessionId: 'sess-1',
      resourceId: 'r-1',
      threadId: 't-1',
      status: 'pending',
    });
  });

  it('HarnessTaskOrigin covers the seven entry surfaces', () => {
    const origins: HarnessTaskOrigin[] = ['user', 'a2a', 'channel', 'cli', 'server', 'subagent-tool', 'system'];
    expect(origins).toHaveLength(7);
  });

  it('HarnessTaskStatus covers pending through terminal states', () => {
    const statuses: HarnessTaskStatus[] = ['pending', 'running', 'paused', 'cancelled', 'succeeded', 'failed'];
    expect(statuses).toHaveLength(6);
  });

  it('HarnessRun carries one execution attempt for a task', () => {
    const run: HarnessRun = {
      runId: 'run-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      modeId: 'default',
      startedAt: 0,
      tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    };

    expect(run.runId).toBe('run-1');
    expect(run.tokenUsage?.totalTokens).toBe(3);
  });

  it('HarnessRunFinishReason matches the public terminal vocabulary', () => {
    const reasons: HarnessRunFinishReason[] = ['complete', 'suspended', 'error', 'aborted', 'budget_exhausted'];
    expect(reasons).toHaveLength(5);
  });

  it('HarnessTaskIndexEntry requires task identity and scope fences', () => {
    const minimal: HarnessTaskIndexEntry = {
      taskId: 'task-x',
      sessionId: 'sess-x',
      resourceId: 'resource-x',
      threadId: 'thread-x',
    };
    const full: HarnessTaskIndexEntry = {
      taskId: 'task-1',
      sessionId: 'sess-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      runId: 'run-1',
      queuedItemId: 'q-1',
      a2aTaskId: 'a2a-1',
    };

    expect(minimal.runId).toBeUndefined();
    expect(full).toMatchObject({ taskId: 'task-1', queuedItemId: 'q-1' });
  });

  it('HarnessEvidence narrows on evidenceKind', () => {
    const admission: HarnessEvidence = {
      evidenceKind: 'admission',
      admission: {
        runId: 'run-1',
        signalId: 'sig-1',
        duplicate: false,
      },
    };
    const workspaceEntry: WorkspaceActionJournalEntry = {
      id: 'wa-1',
      harnessName: 'h',
      sessionId: 'sess-1',
      resourceId: 'r-1',
      threadId: 't-1',
      actionKind: 'file',
      operation: 'read',
      action: { op: 'read', path: '/tmp/x' },
      policyDecision: 'allow',
      policyReasons: [],
      matchedRules: [],
      createdAt: 0,
    };
    const workspace: HarnessEvidence = { evidenceKind: 'workspace-action', entry: workspaceEntry };
    const inboxReceipt: InboxResponseReceipt = {
      responseId: 'resp-1',
      responseHash: 'hash-1',
      resumeAttemptId: 'attempt-1',
      itemId: 'item-1',
      kind: 'tool-approval',
      runId: 'run-1',
      toolCallId: 'tc-1',
      pendingRequestedAt: 0,
      response: { approved: true },
      status: 'accepted',
      acceptedAt: 0,
      updatedAt: 0,
    };
    const inbox: HarnessEvidence = { evidenceKind: 'inbox-receipt', receipt: inboxReceipt };

    function describeEvidence(evidence: HarnessEvidence): string {
      switch (evidence.evidenceKind) {
        case 'admission':
          return `admission:${evidence.admission.signalId ?? 'n/a'}`;
        case 'workspace-action':
          return `workspace:${evidence.entry.id}`;
        case 'inbox-receipt':
          return `inbox:${evidence.receipt.responseId}`;
      }
    }

    const kinds: HarnessEvidenceKind[] = [admission.evidenceKind, workspace.evidenceKind, inbox.evidenceKind];
    expect(kinds).toEqual(['admission', 'workspace-action', 'inbox-receipt']);
    expect(describeEvidence(admission)).toBe('admission:sig-1');
    expect(describeEvidence(workspace)).toBe('workspace:wa-1');
    expect(describeEvidence(inbox)).toBe('inbox:resp-1');
  });

  it('HarnessOperationAdmissionEvidence aliases the existing storage evidence shape', () => {
    const sample: OperationAdmissionEvidence = { runId: 'r', signalId: 's', duplicate: false };
    const canonical: HarnessOperationAdmissionEvidence = sample;
    const legacy: OperationAdmissionEvidence = canonical;
    expect(legacy).toBe(sample);
  });

  it('HarnessAdmissionEvidence projects queue runtime dependencies out of public evidence', () => {
    const queue: QueueAdmissionReceipt = {
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      queuedItemId: 'queue-1',
      runtimeDependencies: { modeId: 'mode-1', agentId: 'agent-1' },
      status: 'queued',
      attempts: 0,
      enqueuedAt: 0,
      updatedAt: 0,
    };
    const publicQueue: HarnessAdmissionEvidence = {
      admissionId: queue.admissionId,
      admissionHash: queue.admissionHash,
      queuedItemId: queue.queuedItemId,
      status: queue.status,
      attempts: queue.attempts,
      enqueuedAt: queue.enqueuedAt,
      updatedAt: queue.updatedAt,
    };

    expect(publicQueue.queuedItemId).toBe('queue-1');
  });

  it('PendingInteraction is the public projection of PendingResume', () => {
    const sample: PendingResume = {
      kind: 'tool-approval',
      runId: 'run-1',
      itemId: 'item-1',
      toolCallId: 'tc-1',
      source: 'parent',
      requestedAt: 0,
    };
    const interaction: PendingInteraction = sample;
    const restored: PendingResume = interaction;

    expect(interaction.kind).toBe('tool-approval');
    expect(restored.itemId).toBe('item-1');
  });

  it('exports the canonical contracts from the public v1 entrypoint', () => {
    const task: ExportedHarnessTask = {
      taskId: 'task-exported',
      origin: 'server',
      sessionId: 'sess',
      resourceId: 'resource',
      threadId: 'thread',
      createdAt: 1,
      status: 'running',
    };
    const admission: ExportedHarnessAdmissionEvidence = {
      runId: 'run-exported',
      signalId: 'signal-exported',
      duplicate: false,
    };
    const evidence: ExportedHarnessEvidence = { evidenceKind: 'admission', admission };
    const pending: ExportedPendingInteraction = {
      kind: 'question',
      runId: 'run-exported',
      itemId: 'item-exported',
      toolCallId: 'tool-call',
      source: 'parent',
      requestedAt: 1,
    };

    expect(task.taskId).toBe('task-exported');
    expect(evidence.evidenceKind).toBe('admission');
    expect(pending.kind).toBe('question');
  });
});
