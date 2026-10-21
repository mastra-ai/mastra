import { describe, expect, it } from 'vitest';

import {
  AUDIT_CATEGORIES,
  auditActionLabel,
  auditCategory,
  auditDetailLine,
  auditNamespacesForCategories,
  auditVisibleMetadata,
} from './auditPresentation';
import type { AuditNamespace } from './auditPresentation';
import type { AuditEvent } from './services/audit';

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'event-1',
    actorId: 'user-1',
    actorType: 'human',
    action: 'factory.work_item.updated',
    targets: [],
    metadata: {},
    occurredAt: '2026-08-21T12:00:00.000Z',
    ...overrides,
  };
}

describe('audit presentation', () => {
  it('labels known actions and categories', () => {
    expect(auditActionLabel('factory.work_item.stage_moved')).toBe('Stage moved');
    expect(auditActionLabel('factory.run.started')).toBe('Run started');
    expect(auditCategory('factory.git.commit')?.label).toBe('Git');
    expect(auditCategory('factory.unknown.changed')).toBeUndefined();
  });

  it('hides internal metadata from the details', () => {
    const auditEvent = event({ metadata: { branch: 'feat/audit', attempts: 2, __actorProfile: { name: 'Ada' } } });

    expect(auditVisibleMetadata(auditEvent)).toEqual({ branch: 'feat/audit', attempts: 2 });
  });

  it('puts only a run outcome or a stage transition on the line, leaving raw metadata to the details', () => {
    const moved = event({ action: 'factory.work_item.stage_moved', metadata: { from: 'execute', to: 'review' } });
    const ended = event({ action: 'factory.run.ended', metadata: { reason: 'aborted', role: 'work' } });
    const started = event({ action: 'factory.run.started', metadata: { role: 'work', branch: 'feat/x' } });

    expect(auditDetailLine(moved)).toBe('Building → Review');
    expect(auditDetailLine(ended)).toBe('aborted');
    expect(auditDetailLine(started)).toBe('');
  });

  it('treats every selected category as no filter', () => {
    const all = new Set<AuditNamespace>(AUDIT_CATEGORIES.map(category => category.namespace));
    expect(auditNamespacesForCategories(all)).toBeUndefined();
    expect(auditNamespacesForCategories(new Set<AuditNamespace>(['agent', 'run']))).toEqual(['run', 'agent']);
  });
});
