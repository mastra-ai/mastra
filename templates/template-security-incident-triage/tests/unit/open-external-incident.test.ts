import { afterEach, expect, it, vi } from 'vitest';

import { deliverExternalIncident } from '../../src/db/provider-delivery-operations.js';
import type { OperationalStore } from '../../src/db/operational-store.js';
import { DomainError } from '../../src/domain/errors.js';
import { createOpenExternalIncidentStep } from '../../src/mastra/steps/open-external-incident.js';

vi.mock('../../src/db/provider-delivery-operations.js', () => ({
  deliverExternalIncident: vi.fn(),
}));
vi.mock('../../src/mastra/workflow-trace.js', () => ({
  withinWorkflowBoundary: (_store: unknown, _context: unknown, fn: () => unknown) => fn(),
}));
afterEach(() => vi.resetAllMocks());

const inputData = {
  status: 'approval-requested',
  plan: {
    tenantId: 'tenant-a',
    incidentId: 'incident-a',
    planHashVersion: 1,
    planHash: 'a'.repeat(64),
    actions: [{ type: 'restore_previous_role' }],
  },
  decision: { severity: 'medium' },
  workflowRunId: 'run-a',
  correlationId: 'correlation-a',
};

function setup() {
  const close = vi.fn();
  const store = {
    execute: vi.fn().mockResolvedValue({
      rows: [
        {
          kind: 'unauthorized_privilege_change',
          status: 'awaiting_approval',
          created_at: '2026-09-07T12:46:35.000Z',
        },
      ],
    }),
    close,
  };
  const step = createOpenExternalIncidentStep({
    openStore: () => store as unknown as OperationalStore,
  });
  // This unit exercises the step body; workflow schema validation is covered in integration tests.
  const run = () => step.execute({ inputData } as unknown as Parameters<typeof step.execute>[0]);
  return { run, close };
}

it.each([
  ['exhausted', 'PROVIDER_DELIVERY_FAILED', false],
  ['uncertain', 'PROVIDER_DELIVERY_UNCERTAIN', false],
  ['retry_scheduled', 'PROVIDER_DELIVERY_PENDING', true],
  ['in_progress', 'PROVIDER_DELIVERY_PENDING', true],
] as const)('reports %s as a provider outcome, not a storage outage', async (status, code, retryable) => {
  vi.mocked(deliverExternalIncident).mockResolvedValue({
    status,
    attemptCount: 1,
  });
  const { run, close } = setup();
  await expect(run()).rejects.toMatchObject({ code, retryable });
  expect(close).toHaveBeenCalledOnce();
});

it('continues only after successful delivery', async () => {
  vi.mocked(deliverExternalIncident).mockResolvedValue({
    status: 'succeeded',
    attemptCount: 1,
  });
  const { run, close } = setup();
  expect(await run()).toBe(inputData);
  expect(close).toHaveBeenCalledOnce();
});

it('preserves actual storage errors', async () => {
  const error = new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
  vi.mocked(deliverExternalIncident).mockRejectedValue(error);
  const { run, close } = setup();
  await expect(run()).rejects.toBe(error);
  expect(close).toHaveBeenCalledOnce();
});
