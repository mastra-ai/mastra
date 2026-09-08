import assert from 'node:assert';

import { describe, expect, it } from 'vitest';

import {
  AUDIT_CATEGORIES,
  auditActionLabel,
  auditActionsForCategories,
  auditActorLabel,
  auditCategory,
  auditEventBounds,
  auditMetadataPreview,
  auditVisibleMetadata,
  type AuditNamespace,
} from './auditPresentation';
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

  it('hides internal metadata from previews and details', () => {
    const auditEvent = event({ metadata: { branch: 'feat/audit', attempts: 2, __actorProfile: { name: 'Ada' } } });

    expect(auditVisibleMetadata(auditEvent)).toEqual({ branch: 'feat/audit', attempts: 2 });
    expect(auditMetadataPreview(auditEvent)).toBe('branch=feat/audit · attempts=2');
  });

  it('formats stage transitions and actor names', () => {
    expect(auditMetadataPreview(event({ action: 'factory.work_item.stage_moved', metadata: { to: 'review' } }))).toBe(
      '→ Review',
    );
    expect(auditActorLabel(event(), 'Ada Lovelace')).toBe('Ada Lovelace');
    expect(auditActorLabel(event({ actorType: 'agent', metadata: { agentName: 'Build agent' } }), undefined)).toBe(
      'Build agent',
    );
  });

  it('treats every selected category as no filter', () => {
    const all = new Set<AuditNamespace>(AUDIT_CATEGORIES.map(category => category.namespace));
    expect(auditActionsForCategories(all)).toBeUndefined();
    expect(auditActionsForCategories(new Set<AuditNamespace>(['run']))).toEqual([
      'factory.run.started',
      'factory.run.approved',
      'factory.run.dismissed',
    ]);
    expect(auditActionsForCategories(new Set<AuditNamespace>(['intake']))).toEqual([
      'factory.intake.config_updated',
      'factory.intake.binding_updated',
    ]);
  });

  it('keeps partial category filters within the server action cap', () => {
    for (const excluded of AUDIT_CATEGORIES) {
      const selected = new Set<AuditNamespace>(
        AUDIT_CATEGORIES.filter(category => category !== excluded).map(category => category.namespace),
      );
      expect(auditActionsForCategories(selected)?.length).toBeLessThanOrEqual(16);
    }
  });

  it('spans the first and last event, padding a single-event log', () => {
    const first = '2026-08-21T08:00:00.000Z';
    const last = '2026-08-24T20:00:00.000Z';

    expect(auditEventBounds([event({ occurredAt: last }), event({ occurredAt: first })])).toEqual({
      from: Date.parse(first),
      to: Date.parse(last),
    });

    const alone = auditEventBounds([event({ occurredAt: first })]);
    assert(alone);
    expect(alone.to - alone.from).toBe(60 * 60_000);
  });

  it('has no bounds when no event carries a usable time', () => {
    expect(auditEventBounds([])).toBeUndefined();
    expect(auditEventBounds([event({ occurredAt: 'not-a-date' })])).toBeUndefined();
  });
});
