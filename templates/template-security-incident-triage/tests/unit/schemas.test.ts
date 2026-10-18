import { describe, expect, it } from 'vitest';

import { makeAlert, makePlan, planHash } from '../fixtures/domain.js';
import {
  AlertSchema,
  ApprovalDecisionSchema,
  ApprovalRequestSchema,
  ContainmentPlanSchema,
  DomainEventSchema,
  EvidenceSchema,
  IncidentSchema,
  IncidentSummarySchema,
  SeverityClassificationSchema,
} from '../../src/schemas/index.js';

const timestamp = '2026-08-27T12:00:00.000Z';

describe('strict versioned schemas', () => {
  it('accepts valid boundary objects', () => {
    expect(AlertSchema.parse(makeAlert())).toEqual(makeAlert());
    expect(ContainmentPlanSchema.parse(makePlan())).toEqual(makePlan());
    expect(
      EvidenceSchema.parse({
        schemaVersion: 1,
        hashVersion: 1,
        evidenceId: 'evidence-1',
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        source: 'identity',
        provider: 'mock-workos',
        observedAt: timestamp,
        collectedAt: timestamp,
        fact: { role: 'admin' },
        confidence: 0.9,
        rawPayloadRef: 'protected://evidence/1',
        integrityHash: planHash,
        sensitivity: 'internal',
        incomplete: false,
      }).evidenceId,
    ).toBe('evidence-1');
    expect(
      IncidentSchema.parse({
        schemaVersion: 1,
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        subjectId: 'subject-1',
        kind: 'unknown_device_login',
        severity: 'medium',
        status: 'investigating',
        version: 2,
        timelineSequence: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
      }).version,
    ).toBe(2);
    expect(
      DomainEventSchema.parse({
        type: 'security.alert.received',
        runId: 'run-1',
        data: {
          eventId: 'event-1',
          schemaVersion: 1,
          occurredAt: timestamp,
          incidentId: 'incident-1',
          tenantId: 'tenant-1',
          correlationId: 'correlation-1',
          payload: { alertId: 'alert-1' },
        },
      }).data.schemaVersion,
    ).toBe(1);
  });

  it('rejects unknown critical fields and incompatible versions', () => {
    expect(() => AlertSchema.parse({ ...makeAlert(), admin: true })).toThrow();
    expect(() => AlertSchema.parse({ ...makeAlert(), schemaVersion: 2 })).toThrow();
    expect(() =>
      DomainEventSchema.parse({
        type: 'security.alert.received',
        runId: 'run-1',
        data: {
          eventId: 'event-1',
          schemaVersion: 2,
          occurredAt: timestamp,
          incidentId: 'incident-1',
          tenantId: 'tenant-1',
          correlationId: 'correlation-1',
          payload: {},
        },
      }),
    ).toThrow();
  });

  it('rejects malformed enums, UTC dates, hashes, JSON and references', () => {
    expect(() => AlertSchema.parse({ ...makeAlert(), occurredAt: timestamp.slice(0, -1) })).toThrow();
    expect(() => AlertSchema.parse({ ...makeAlert(), kind: 'other' })).toThrow();
    expect(() => AlertSchema.parse({ ...makeAlert(), changes: { value: Number.NaN } })).toThrow();
    expect(() => ContainmentPlanSchema.parse({ ...makePlan(), planHash: 'abc' })).toThrow();
    expect(() =>
      SeverityClassificationSchema.parse({
        schemaVersion: 1,
        incidentId: 'incident-1',
        severity: 'high',
        rationale: 'Supported by the identity event.',
        references: ['[evidence:bad reference]'],
      }),
    ).toThrow();
  });

  it('requires support for factual claims and reason for rejection', () => {
    expect(() =>
      IncidentSummarySchema.parse({
        schemaVersion: 1,
        incidentId: 'incident-1',
        summary: 'A concise summary.',
        claims: [
          {
            text: 'The role changed.',
            hypothesis: false,
            references: ['[evidence:evidence-1]'],
          },
        ],
      }),
    ).not.toThrow();
    for (const references of [[], ['[runbook:RB-IDENTITY-001@1.0.0]']]) {
      expect(() =>
        IncidentSummarySchema.parse({
          schemaVersion: 1,
          incidentId: 'incident-1',
          summary: 'A concise summary.',
          claims: [
            {
              text: 'The role changed.',
              hypothesis: false,
              references,
            },
          ],
        }),
      ).toThrow();
    }
    expect(() =>
      IncidentSummarySchema.parse({
        schemaVersion: 1,
        incidentId: 'incident-1',
        summary: 'A concise summary.',
        claims: [
          {
            text: 'The role may have changed.',
            hypothesis: true,
            references: [],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      ApprovalDecisionSchema.parse({
        schemaVersion: 1,
        approvalId: 'approval-1',
        planId: 'plan-1',
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        planHashVersion: 1,
        planHash,
        decision: 'rejected',
        decidedBy: 'manager-1',
        decidedByRole: 'soc_manager',
        decidedAt: timestamp,
      }),
    ).toThrow();
  });

  it('enforces version and strictness on every top-level boundary schema', () => {
    const evidence = {
      schemaVersion: 1,
      hashVersion: 1,
      evidenceId: 'evidence-1',
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      source: 'identity',
      provider: 'mock-workos',
      observedAt: timestamp,
      collectedAt: timestamp,
      fact: { role: 'admin' },
      confidence: 0.9,
      rawPayloadRef: 'protected://evidence/1',
      integrityHash: planHash,
      sensitivity: 'internal',
      incomplete: false,
    };
    const incident = {
      schemaVersion: 1,
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      subjectId: 'subject-1',
      kind: 'unknown_device_login',
      status: 'investigating',
      version: 1,
      timelineSequence: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const severity = {
      schemaVersion: 1,
      incidentId: 'incident-1',
      severity: 'high',
      rationale: 'Supported by evidence.',
      references: ['[evidence:evidence-1]'],
    };
    const summary = {
      schemaVersion: 1,
      incidentId: 'incident-1',
      summary: 'A concise summary.',
      claims: [
        {
          text: 'The role changed.',
          hypothesis: false,
          references: ['[evidence:evidence-1]'],
        },
      ],
    };
    const approvalRequest = {
      schemaVersion: 1,
      approvalId: 'approval-1',
      planId: 'plan-1',
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      planHashVersion: 1,
      planHash,
      requestedAt: timestamp,
      expiresAt: '2026-08-27T13:00:00.000Z',
      status: 'pending',
    };
    const approvalDecision = {
      schemaVersion: 1,
      approvalId: 'approval-1',
      planId: 'plan-1',
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      planHashVersion: 1,
      planHash,
      decision: 'approved',
      decidedBy: 'manager-1',
      decidedByRole: 'soc_manager',
      decidedAt: timestamp,
    };
    const domainEvent = {
      type: 'security.alert.received',
      runId: 'run-1',
      data: {
        eventId: 'event-1',
        schemaVersion: 1,
        occurredAt: timestamp,
        incidentId: 'incident-1',
        tenantId: 'tenant-1',
        correlationId: 'correlation-1',
        payload: { alertId: 'alert-1' },
      },
    };
    const cases = [
      { schema: AlertSchema, value: makeAlert(), versionPath: 'root' },
      { schema: EvidenceSchema, value: evidence, versionPath: 'root' },
      { schema: IncidentSchema, value: incident, versionPath: 'root' },
      {
        schema: SeverityClassificationSchema,
        value: severity,
        versionPath: 'root',
      },
      { schema: IncidentSummarySchema, value: summary, versionPath: 'root' },
      { schema: ContainmentPlanSchema, value: makePlan(), versionPath: 'root' },
      {
        schema: ApprovalRequestSchema,
        value: approvalRequest,
        versionPath: 'root',
      },
      {
        schema: ApprovalDecisionSchema,
        value: approvalDecision,
        versionPath: 'root',
      },
      { schema: DomainEventSchema, value: domainEvent, versionPath: 'data' },
    ] as const;

    for (const { schema, value, versionPath } of cases) {
      expect(schema.safeParse(value).success).toBe(true);
      expect(schema.safeParse({ ...value, unexpected: true }).success).toBe(false);
      const incompatible =
        versionPath === 'data'
          ? { ...value, data: { ...domainEvent.data, schemaVersion: 2 } }
          : { ...value, schemaVersion: 2 };
      expect(schema.safeParse(incompatible).success).toBe(false);
    }
  });
});
