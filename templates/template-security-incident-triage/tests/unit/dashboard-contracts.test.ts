import { describe, expect, it } from 'vitest';

import { DashboardManualReviewRequestSchema, decodeCursor, encodeCursor } from '../../src/app/dashboard/contracts.js';
import { redactTimelinePayload, safeExternalUrl } from '../../src/app/dashboard/redaction.js';
import { parseLastEventId } from '../../src/app/dashboard/sse.js';
import { projectDashboardOperationalState, projectDashboardRunbook } from '../../src/app/dashboard/queries.js';

describe('dashboard dashboard projections and SSE', () => {
  it.each([
    ['investigating', undefined, null, null, [], 'not_requested', 'not_started'],
    ['investigating', 'manual-review', null, null, [], 'manual_review', 'not_applicable'],
    ['closed', 'manual-review', null, 'resolved', [], 'resolved', 'not_applicable'],
    ['awaiting_approval', 'ready-for-approval', null, null, ['pending'], 'pending', 'awaiting_decision'],
    ['containing', 'ready-for-approval', 'approved', null, ['executing', 'pending'], 'approved', 'in_progress'],
    ['contained', 'ready-for-approval', 'approved', null, ['completed'], 'approved', 'completed'],
    ['rejected', 'ready-for-approval', 'rejected', null, ['pending'], 'rejected', 'not_executed'],
    ['failed', 'blocked', null, null, [], 'not_requested', 'failed'],
  ] as const)(
    'projects %s into decision %s and execution state',
    (incidentStatus, triageStatus, approvalDecision, manualReviewDecision, actionStatuses, decision, execution) => {
      expect(
        projectDashboardOperationalState({
          incidentStatus,
          ...(triageStatus ? { triageStatus } : {}),
          approvalDecision,
          manualReviewDecision,
          actionStatuses,
        }),
      ).toEqual({ decision, execution });
    },
  );

  it('requires an audit note when a manual review is resolved and closed', () => {
    expect(
      DashboardManualReviewRequestSchema.safeParse({
        decision: 'resolved',
        workflowRunId: 'run-1',
      }).success,
    ).toBe(false);
    expect(
      DashboardManualReviewRequestSchema.safeParse({
        decision: 'resolved',
        reason: 'Analyst completed the investigation.',
        workflowRunId: 'run-1',
      }).success,
    ).toBe(true);
  });

  it('projects the exact runbook generation and marks retrieved sections', () => {
    const base = {
      retrieval_id: 'retrieval-1',
      runbook_id: 'RB-IDENTITY-001',
      version: '1.0.0',
      owner: 'security',
      source_path: 'runbooks/unauthorized-privilege-change.md',
    };
    expect(
      projectDashboardRunbook([
        {
          ...base,
          section_key: 'purpose',
          section_ordinal: 1,
          chunk_ordinal: 0,
          text: '## Purpose\n\nInvestigate the scoped role change.',
          selected: 1,
        },
        {
          ...base,
          section_key: 'validation',
          section_ordinal: 2,
          chunk_ordinal: 0,
          text: '## Validation\n\nVerify only the scoped subject changed.',
          selected: 0,
        },
      ] as never),
    ).toMatchObject({
      runbookId: 'RB-IDENTITY-001',
      version: '1.0.0',
      sections: [
        {
          title: 'Purpose',
          content: 'Investigate the scoped role change.',
          selected: true,
        },
        { title: 'Validation', selected: false },
      ],
    });
  });

  it('redacts forbidden timeline data by construction', () => {
    expect(
      redactTimelinePayload({
        status: 'approved',
        rawPayloadRef: 'secret',
        token: 'abc',
        nested: { value: 1 },
      }),
    ).toEqual({ status: 'approved' });
  });
  it('uses tenant-bound opaque cursors and rejects malformed cursors', () => {
    const cursor = encodeCursor(
      {
        updatedAt: '2026-08-28T00:00:00.000Z',
        incidentId: 'incident_123',
        tenantId: 'tenant_123',
        filters: '{}',
      },
      'c'.repeat(32),
    );
    expect(decodeCursor(cursor, { tenantId: 'tenant_123', filters: '{}' }, 'c'.repeat(32))).toEqual({
      updatedAt: '2026-08-28T00:00:00.000Z',
      incidentId: 'incident_123',
    });
    expect(decodeCursor(cursor, { tenantId: 'tenant_other', filters: '{}' }, 'c'.repeat(32))).toBeNull();
    expect(decodeCursor(`${cursor}x`, { tenantId: 'tenant_123', filters: '{}' }, 'c'.repeat(32))).toBeNull();
    expect(decodeCursor('not-a-cursor', { tenantId: 'tenant_123', filters: '{}' }, 'c'.repeat(32))).toBeNull();
  });
  it("accepts only a current incident's monotonic SSE identifiers", () => {
    expect(parseLastEventId('incident_123', 'incident_123:4')).toBe(4);
    expect(parseLastEventId('incident_123', 'other:4')).toBeNull();
    expect(parseLastEventId('incident_123', 'incident_123:0')).toBeNull();
    expect(safeExternalUrl('https://linear.app/team/SEC-1')).toBe('https://linear.app/team/SEC-1');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
  });
});
