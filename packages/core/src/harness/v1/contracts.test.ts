/**
 * Harness v1 — canonical contracts.
 *
 * Compile-time + structural assertions on the type-only canonical
 * Task / Run / TaskIndexEntry shapes. There is no runtime behavior to
 * exercise; these tests pin the field set so accidental renames or
 * widening break the build.
 */

import { describe, expect, it } from 'vitest';

import type {
  HarnessOperationAdmissionEvidence,
  InboxResponseReceipt,
  OperationAdmissionEvidence,
  WorkspaceActionJournalEntry,
} from '../../storage/domains/harness';
import type {
  HarnessEvidence,
  HarnessEvidenceKind,
  HarnessRun,
  HarnessRunFinishReason,
  HarnessTask,
  HarnessTaskOrigin,
  HarnessTaskStatus,
  TaskIndexEntry,
} from './contracts';

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

  it('HarnessTaskOrigin covers the six entry surfaces', () => {
    const origins: HarnessTaskOrigin[] = ['user', 'a2a', 'channel', 'cli', 'server', 'system'];
    expect(origins).toHaveLength(6);
  });

  it('HarnessTaskStatus covers pending → terminal', () => {
    const statuses: HarnessTaskStatus[] = ['pending', 'running', 'paused', 'cancelled', 'succeeded', 'failed'];
    expect(statuses).toHaveLength(6);
  });

  it('HarnessRun carries the documented field set', () => {
    const run: HarnessRun = {
      runId: 'run-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      modeId: 'default',
      startedAt: 0,
    };
    expect(run.runId).toBe('run-1');
    expect(run.taskId).toBe('task-1');
  });

  it('HarnessRunFinishReason matches agent_end vocabulary', () => {
    const reasons: HarnessRunFinishReason[] = ['complete', 'suspended', 'error', 'aborted', 'budget_exhausted'];
    expect(reasons).toHaveLength(5);
  });

  it('TaskIndexEntry shape supports cross-surface lookup', () => {
    const entry: TaskIndexEntry = {
      taskId: 'task-1',
      sessionId: 'sess-1',
      runId: 'run-1',
      queuedItemId: 'q-1',
      a2aTaskId: 'a2a-1',
    };
    expect(entry).toMatchObject({ taskId: 'task-1', sessionId: 'sess-1' });
  });

  it('TaskIndexEntry only requires taskId + sessionId', () => {
    const entry: TaskIndexEntry = { taskId: 'task-x', sessionId: 'sess-x' };
    expect(entry.runId).toBeUndefined();
    expect(entry.queuedItemId).toBeUndefined();
    expect(entry.a2aTaskId).toBeUndefined();
  });

  it('HarnessEvidenceKind enumerates the three proof sources', () => {
    const kinds: HarnessEvidenceKind[] = ['admission', 'workspace-action', 'inbox-receipt'];
    expect(kinds).toHaveLength(3);
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

    function describeEvidence(e: HarnessEvidence): string {
      switch (e.evidenceKind) {
        case 'admission':
          return `admission:${e.admission.signalId ?? 'n/a'}`;
        case 'workspace-action':
          return `workspace:${e.entry.id}`;
        case 'inbox-receipt':
          return `inbox:${e.receipt.responseId}`;
      }
    }

    expect(describeEvidence(admission)).toBe('admission:sig-1');
    expect(describeEvidence(workspace)).toBe('workspace:wa-1');
    expect(describeEvidence(inbox)).toBe('inbox:resp-1');
  });

  it('OperationAdmissionEvidence (deprecated) resolves to HarnessOperationAdmissionEvidence', () => {
    const sample: HarnessOperationAdmissionEvidence = { runId: 'r', signalId: 's', duplicate: false };
    const aliased: OperationAdmissionEvidence = sample;
    expect(aliased).toBe(sample);
  });
});
