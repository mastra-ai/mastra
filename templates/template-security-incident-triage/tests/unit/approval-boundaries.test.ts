import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LocalDecisionAuthenticator } from '../../src/approval/local-decision-authenticator.js';
import {
  ApprovalDecisionRequestSchema,
  ApprovalResumePayloadSchema,
  ApprovalSuspendPayloadSchema,
} from '../../src/schemas/approval.js';
import { ExternalIncidentProjectionSchema } from '../../src/providers/incident-provider.js';
import { planHash } from '../fixtures/domain.js';

describe('approval and containment strict boundaries', () => {
  it('keeps containment effect primitives private to the gateway module', () => {
    expect(existsSync(resolve(process.cwd(), 'src/containment/mock-adapters/internal.ts'))).toBe(false);
    const source = readFileSync(resolve(process.cwd(), 'src/containment/gateway.ts'), 'utf8');
    expect(source).not.toMatch(/export\s+(?:function|class|type)\s+(?:createInternal|InternalMock|Capability)/u);
  });

  it('keeps suspend public and resume token-only', () => {
    expect(
      ApprovalSuspendPayloadSchema.parse({
        incidentId: 'incident-1',
        workflowRunId: 'run-1',
        approvalId: 'approval-1',
        planHashVersion: 1,
        planHash,
        expiresAt: '2026-08-27T13:00:00.000Z',
      }),
    ).not.toHaveProperty('decision');
    expect(() =>
      ApprovalResumePayloadSchema.parse({
        resumeReceiptId: 'receipt-1',
        decision: 'approved',
      }),
    ).toThrow();
    expect(() =>
      ApprovalDecisionRequestSchema.parse({
        decision: 'rejected',
        planId: 'plan-1',
        planHashVersion: 1,
        planHash,
      }),
    ).toThrow();
  });

  it('authenticates an exact mock request once and rejects replay/staging', async () => {
    const secret = 'decision-secret-'.padEnd(40, 'x');
    const timestamp = 1_787_920_000_000;
    const nonce = 'nonce-1234567890abcdef';
    const path = '/api/incidents/incident-1/approvals/approval-1/decision';
    const rawBody = new TextEncoder().encode('{"decision":"approved"}');
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${nonce}.POST.${path}.`)
      .update('tenant-1.')
      .update(rawBody)
      .digest('hex');
    const input = {
      method: 'POST',
      path,
      rawBody,
      signature: `t=${timestamp},v1=${signature}`,
      nonce,
      tenantId: 'tenant-1',
    };
    const authenticator = new LocalDecisionAuthenticator({
      mode: 'local',
      enabled: true,
      secret,
      nowMs: () => timestamp,
    });
    await expect(authenticator.authenticate(input)).resolves.toEqual({
      actorId: 'studio-soc-manager',
      tenantId: 'tenant-1',
      role: 'soc_manager',
      local: true,
    });
    await expect(authenticator.authenticate(input)).rejects.toMatchObject({
      code: 'AUTHENTICATION_REPLAYED',
    });
    await expect(
      new LocalDecisionAuthenticator({
        mode: 'staging',
        enabled: true,
        secret,
        nowMs: () => timestamp,
      }).authenticate(input),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_MODE_DENIED' });
  });

  it('binds the authenticated tenant to the HMAC', async () => {
    const secret = 'decision-secret-'.padEnd(40, 'x');
    const timestamp = 1_787_920_000_000;
    const nonce = 'tenant-bound-nonce-1234';
    const path = '/api/incidents/incident-1/approvals/approval-1/decision';
    const rawBody = new TextEncoder().encode('{"decision":"approved"}');
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${nonce}.POST.${path}.`)
      .update('tenant-1.')
      .update(rawBody)
      .digest('hex');
    const authenticator = new LocalDecisionAuthenticator({
      mode: 'local',
      enabled: true,
      secret,
      nowMs: () => timestamp,
    });
    await expect(
      authenticator.authenticate({
        method: 'POST',
        path,
        rawBody,
        signature: `t=${timestamp},v1=${signature}`,
        nonce,
        tenantId: 'tenant-2',
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_INVALID' });
  });

  it('rejects secret-bearing or oversized external projections', () => {
    const base = {
      incidentId: 'incident-1',
      tenantId: 'tenant-1',
      kind: 'unknown_device_login' as const,
      severity: 'high' as const,
      status: 'awaiting_approval' as const,
      occurredAt: '2026-08-27T12:00:00.000Z',
      summaryCode: 'UNKNOWN_DEVICE_REQUIRES_REVIEW' as const,
      planHashVersion: 1 as const,
      planHash,
      actionTypes: ['revoke_session' as const],
    };
    expect(ExternalIncidentProjectionSchema.parse(base)).toEqual(base);
    expect(() => ExternalIncidentProjectionSchema.parse({ ...base, secret: 'raw-token' })).toThrow();
  });
});
