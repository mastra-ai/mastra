import { describe, expect, it } from 'vitest';

import { LocalIncidentProvider } from '../../src/providers/local-incident-provider.js';
import {
  ExternalIncidentSupersededError,
  type ExternalIncidentProjection,
} from '../../src/providers/incident-provider.js';

const projection: ExternalIncidentProjection = {
  incidentId: 'incident-a',
  tenantId: 'tenant-a',
  kind: 'unauthorized_privilege_change',
  severity: 'medium',
  status: 'awaiting_approval',
  occurredAt: '2026-09-07T12:46:35.000Z',
  summaryCode: 'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
  planHashVersion: 1,
  planHash: 'a'.repeat(64),
  actionTypes: ['restore_previous_role'],
};

describe('local incident generation isolation', () => {
  it.each([{ incidentId: 'incident-b' }, { tenantId: 'tenant-b' }])(
    'isolates a different scope %j with equal and lower generations',
    async scope => {
      const provider = new LocalIncidentProvider();
      const first = { projection, idempotencyKey: 'first', generation: 2 };
      const created = await provider.create(first);
      const second = {
        projection: { ...projection, ...scope },
        idempotencyKey: 'second',
        generation: 2,
      };
      const other = await provider.create(second);
      await provider.update({
        ...first,
        idempotencyKey: 'first-final',
        generation: 3,
        externalRef: created.externalRef,
      });
      expect(await provider.create(second)).toEqual(other);
      expect(await provider.reconcile({ ...second, operation: 'create' })).toEqual(other);
      expect(provider.calls).toHaveLength(3);
    },
  );

  it('still rejects stale and conflicting generations within one incident', async () => {
    const provider = new LocalIncidentProvider();
    await provider.create({ projection, idempotencyKey: 'new', generation: 3 });
    await expect(provider.create({ projection, idempotencyKey: 'old', generation: 2 })).rejects.toBeInstanceOf(
      ExternalIncidentSupersededError,
    );
    await expect(
      provider.create({
        projection,
        idempotencyKey: 'conflict',
        generation: 3,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(provider.calls).toHaveLength(1);
  });

  it('rechecks only the same incident after an asynchronous persistence boundary', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const provider = new LocalIncidentProvider({
      beforePersist: async ({ idempotencyKey }) => {
        if (idempotencyKey === 'slow') await gate;
      },
    });
    const slow = provider.create({
      projection,
      idempotencyKey: 'slow',
      generation: 2,
    });
    await provider.create({
      projection: { ...projection, incidentId: 'incident-b' },
      idempotencyKey: 'fast',
      generation: 3,
    });
    release();
    await expect(slow).resolves.toHaveProperty('externalRef');
    expect(provider.calls).toHaveLength(2);
  });

  it('fences a same-incident stale request that finishes late', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const provider = new LocalIncidentProvider({
      beforePersist: async ({ idempotencyKey }) => {
        if (idempotencyKey === 'slow') await gate;
      },
    });
    const slow = provider.create({
      projection,
      idempotencyKey: 'slow',
      generation: 2,
    });
    await provider.create({
      projection,
      idempotencyKey: 'fast',
      generation: 3,
    });
    release();
    await expect(slow).rejects.toBeInstanceOf(ExternalIncidentSupersededError);
    expect(provider.calls).toHaveLength(1);
  });
});
