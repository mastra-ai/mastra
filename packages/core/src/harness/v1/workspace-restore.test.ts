import { describe, expect, it } from 'vitest';

import type { WorkspaceActionJournalEntry, WorkspaceActionJournalPath } from '../../storage/domains/harness';
import { HarnessValidationError } from './errors';
import { createWorkspaceRestorePlan, workspaceRestoreEntryMatchesScope } from './workspace-restore';
import type { WorkspaceRestorePlan } from './workspace-restore';

const notesPath = workspacePath('notes.md');
const oldPath = workspacePath('src/old.ts');
const newPath = workspacePath('src/new.ts');

describe('workspace restore planner', () => {
  it('plans session restores in reverse journal order without mutating files', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({ id: 'write-notes', createdAt: 1000, result: { before: 'old notes', after: 'new notes' } }),
        journalEntry({
          id: 'patch-notes',
          createdAt: 1100,
          operation: 'patch',
          action: { kind: 'file', operation: 'patch', path: 'notes.md' },
          result: { before: 'new notes', after: 'patched notes' },
        }),
        journalEntry({
          id: 'rename-source',
          createdAt: 1200,
          operation: 'rename',
          action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
          path: oldPath,
          toPath: newPath,
          result: { toBefore: null },
        }),
      ],
    });

    expect(plan.truncated).toBe(false);
    expect(plan.steps.map(step => [step.journalEntryId, step.kind, step.status])).toEqual([
      ['rename-source', 'move_path', 'planned'],
      ['patch-notes', 'reverse_patch', 'planned'],
      ['write-notes', 'restore_file', 'planned'],
    ]);
    expect(plan.steps[0]).toMatchObject({ path: newPath, toPath: oldPath, conflict: { status: 'unknown' } });
    expect(plan.steps[1]).toMatchObject({ path: notesPath, snapshot: 'new notes' });
    expect(plan.steps[2]).toMatchObject({ path: notesPath, snapshot: 'old notes' });
    expect(plan.affectedPaths.map(item => item.path.relativePath)).toEqual(['notes.md', 'src/new.ts', 'src/old.ts']);
  });

  it('uses null before snapshots to plan deletion for files created by a write', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'turn', requestId: 'turn-1' },
      entries: [
        journalEntry({
          id: 'create-file',
          requestId: 'turn-1',
          result: { before: null, after: 'created content' },
        }),
        journalEntry({ id: 'other-turn', requestId: 'turn-2', result: { before: 'ignore' } }),
      ],
    });

    expect(plan.steps).toEqual([
      expect.objectContaining({
        journalEntryId: 'create-file',
        kind: 'delete_file',
        status: 'planned',
        snapshot: null,
      }),
    ]);
  });

  it('marks unsupported, no-op, and missing-evidence rows deterministically', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({
          id: 'read-file',
          operation: 'read',
          action: { kind: 'file', operation: 'read', path: 'notes.md' },
        }),
        journalEntry({
          id: 'stat-file',
          operation: 'stat',
          action: { kind: 'file', operation: 'stat', path: 'notes.md' },
        }),
        journalEntry({
          id: 'readfile-file',
          operation: 'readFile',
          action: { kind: 'file', operation: 'readFile', path: 'notes.md' },
        }),
        journalEntry({
          id: 'listfiles-file',
          operation: 'listFiles',
          action: { kind: 'file', operation: 'listFiles', path: 'src' },
        }),
        journalEntry({
          id: 'grep-file',
          operation: 'grep',
          action: { kind: 'file', operation: 'grep', path: 'src' },
        }),
        journalEntry({
          id: 'lspinspect-file',
          operation: 'lspInspect',
          action: { kind: 'file', operation: 'lspInspect', path: 'src/index.ts' },
        }),
        journalEntry({ id: 'denied-write', policyDecision: 'deny', result: { before: 'old' } }),
        journalEntry({
          id: 'missing-before',
          operation: 'delete',
          action: { kind: 'file', operation: 'delete', path: 'notes.md' },
          result: undefined,
        }),
        journalEntry({
          id: 'command-run',
          actionKind: 'command',
          operation: 'run',
          action: { kind: 'command', operation: 'run', command: 'pnpm test' },
          path: undefined,
        }),
      ],
    });

    expect(plan.steps.map(step => [step.journalEntryId, step.status, step.conflict.status])).toEqual([
      ['stat-file', 'skipped', 'no_effect'],
      ['readfile-file', 'skipped', 'no_effect'],
      ['read-file', 'skipped', 'no_effect'],
      ['missing-before', 'blocked', 'missing_before_snapshot'],
      ['lspinspect-file', 'skipped', 'no_effect'],
      ['listfiles-file', 'skipped', 'no_effect'],
      ['grep-file', 'skipped', 'no_effect'],
      ['denied-write', 'skipped', 'no_effect'],
      ['command-run', 'blocked', 'unsupported_operation'],
    ]);
  });

  it('blocks unhandled file mutation audit operations for manual review', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: ['mkdir', 'rmdir', 'copy', 'move'].map((operation, index) =>
        journalEntry({
          id: `unsupported-${operation}`,
          createdAt: 1000 + index,
          operation,
          action: { kind: 'file', operation, path: 'notes.md' },
        }),
      ),
    });

    expect(plan.steps.map(step => [step.journalEntryId, step.kind, step.status, step.conflict.status])).toEqual([
      ['unsupported-move', 'manual_review', 'blocked', 'unsupported_operation'],
      ['unsupported-copy', 'manual_review', 'blocked', 'unsupported_operation'],
      ['unsupported-rmdir', 'manual_review', 'blocked', 'unsupported_operation'],
      ['unsupported-mkdir', 'manual_review', 'blocked', 'unsupported_operation'],
    ]);
  });

  it('handles null before snapshots by operation without inventing restore work', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({
          id: 'delete-missing',
          operation: 'delete',
          action: { kind: 'file', operation: 'delete', path: 'notes.md' },
          result: { before: null },
        }),
        journalEntry({
          id: 'patch-missing',
          operation: 'patch',
          action: { kind: 'file', operation: 'patch', path: 'notes.md' },
          result: { before: null },
        }),
      ],
    });

    expect(plan.steps.map(step => [step.journalEntryId, step.kind, step.status, step.conflict.status])).toEqual([
      ['patch-missing', 'reverse_patch', 'blocked', 'missing_before_snapshot'],
      ['delete-missing', 'skip', 'skipped', 'no_effect'],
    ]);
  });

  it('blocks rename plans when destination overwrite evidence requires manual review', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({
          id: 'rename-overwrite',
          operation: 'rename',
          action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
          path: oldPath,
          toPath: newPath,
          result: { toBefore: 'overwritten destination' },
        }),
      ],
    });

    expect(plan.steps).toEqual([
      expect.objectContaining({
        journalEntryId: 'rename-overwrite',
        kind: 'manual_review',
        status: 'blocked',
        conflict: expect.objectContaining({ status: 'unsupported_operation' }),
      }),
    ]);
  });

  it('blocks rename plans without explicit destination evidence', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({
          id: 'rename-unknown-destination',
          operation: 'rename',
          action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
          path: oldPath,
          toPath: newPath,
          result: { status: 'changed' },
        }),
      ],
    });

    expect(plan.steps).toEqual([
      expect.objectContaining({
        journalEntryId: 'rename-unknown-destination',
        kind: 'move_path',
        status: 'blocked',
        conflict: expect.objectContaining({ status: 'missing_before_snapshot' }),
      }),
    ]);
  });

  it('matches file scope against destination paths only when requested', () => {
    const rename = journalEntry({
      id: 'rename-source',
      operation: 'rename',
      action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
      path: oldPath,
      toPath: newPath,
    });

    expect(
      workspaceRestoreEntryMatchesScope(rename, {
        kind: 'file',
        affectedPath: { rootId: 'project', relativePath: 'src/new.ts' },
      }),
    ).toBe(false);
    expect(
      workspaceRestoreEntryMatchesScope(rename, {
        kind: 'file',
        affectedPath: { rootId: 'project', relativePath: 'src/new.ts', includeToPath: true },
      }),
    ).toBe(true);
    expect(
      workspaceRestoreEntryMatchesScope(rename, {
        kind: 'file',
        affectedPath: { rootId: 'project', relativePath: 'src/other.ts' },
      }),
    ).toBe(false);
  });

  it('uses stable journal id ordering for same-timestamp entries', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({ id: 'a', createdAt: 1000, result: { before: 'lowercase' } }),
        journalEntry({ id: 'Z', createdAt: 1000, result: { before: 'uppercase' } }),
      ],
    });

    expect(plan.steps.map(step => step.journalEntryId)).toEqual(['a', 'Z']);
  });

  it('does not block denied non-file journal rows', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [
        journalEntry({
          id: 'denied-command',
          actionKind: 'command',
          operation: 'run',
          policyDecision: 'deny',
          action: { kind: 'command', operation: 'run', command: 'pnpm test' },
          path: undefined,
        }),
      ],
    });

    expect(plan.steps).toEqual([
      expect.objectContaining({
        journalEntryId: 'denied-command',
        kind: 'skip',
        status: 'skipped',
        conflict: expect.objectContaining({ status: 'no_effect' }),
      }),
    ]);
  });

  it('bounds host-provided entries and reports truncation', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      limit: 2,
      entries: [
        journalEntry({ id: 'a', createdAt: 1000, result: { before: 'a' } }),
        journalEntry({ id: 'b', createdAt: 1100, result: { before: 'b' } }),
        journalEntry({ id: 'c', createdAt: 1200, result: { before: 'c' } }),
      ],
    });

    expect(plan.truncated).toBe(true);
    expect(plan.steps.map(step => step.journalEntryId)).toEqual(['c', 'b']);
  });

  it('rejects invalid limits', () => {
    expect(() =>
      createWorkspaceRestorePlan({
        scope: { kind: 'session' },
        limit: 0,
        entries: [journalEntry()],
      }),
    ).toThrow(HarnessValidationError);
  });

  it('rejects file scopes without an affected path selector', () => {
    expect(() =>
      createWorkspaceRestorePlan({
        scope: { kind: 'file', affectedPath: {} },
        entries: [journalEntry()],
      }),
    ).toThrow(HarnessValidationError);
  });

  it('returns cloned plan data', () => {
    const plan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [journalEntry({ result: { before: { text: 'old' }, after: { text: 'new' } } })],
    });

    (plan.steps[0]?.snapshot as Record<string, string>).text = 'mutated';
    (plan.steps[0]?.path as WorkspaceActionJournalPath).relativePath = 'mutated.md';

    const freshPlan = createWorkspaceRestorePlan({
      scope: { kind: 'session' },
      entries: [journalEntry({ result: { before: { text: 'old' }, after: { text: 'new' } } })],
    });

    expect(firstStep(freshPlan).snapshot).toEqual({ text: 'old' });
    expect(firstStep(freshPlan).path?.relativePath).toBe('notes.md');
  });
});

function firstStep(plan: WorkspaceRestorePlan) {
  const [step] = plan.steps;
  if (!step) throw new Error('expected restore step');
  return step;
}

function workspacePath(relativePath: string): WorkspaceActionJournalPath {
  return {
    rootId: 'project',
    rootPath: '/workspace/project',
    path: `/workspace/project/${relativePath}`,
    relativePath,
  };
}

function journalEntry(overrides: Partial<WorkspaceActionJournalEntry> = {}): WorkspaceActionJournalEntry {
  return {
    id: 'entry-1',
    harnessName: 'default',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    actionKind: 'file',
    operation: 'write',
    action: { kind: 'file', operation: 'write', path: 'notes.md' },
    policyDecision: 'ask',
    policyReasons: ['workspace.default_ask'],
    matchedRules: [],
    path: notesPath,
    actor: { type: 'user', id: 'user-1' },
    requestId: 'turn-1',
    result: { before: 'old notes', after: 'new notes' },
    createdAt: 1000,
    ...overrides,
  };
}
