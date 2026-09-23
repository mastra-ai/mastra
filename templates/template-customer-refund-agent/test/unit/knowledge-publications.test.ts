import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgePublicationStore } from '../../src/mastra/lib/knowledge-publications';

const binding = {
  tenantId: `tenant-a-${crypto.randomUUID()}`,
  providerKind: 'local' as const,
  providerAccountId: `account-a-${crypto.randomUUID()}`,
  externalConversationId: 'conversation-a',
};
const document = (text: string, version: string) => ({
  title: 'Refund policy',
  source: 'policy://refund',
  text,
  version,
  effectiveAt: '2026-01-01T00:00:00.000Z',
  score: 1,
});

describe('knowledge publication generations', () => {
  afterEach(() => vi.useRealTimers());
  it('serves only the activated tenant generation, keeps failures and stale writers from replacing it, and rolls back', async () => {
    const store = new KnowledgePublicationStore(createClient({ url: process.env.DATABASE_URL! }));
    const first = await store.buildCandidate(binding, [document('refunds require approval', 'v1')]);
    await store.activate(binding, first.generationId, {
      generationId: undefined,
      revision: 0,
    });
    expect((await store.search(binding, 'refund approval', 5)).map(entry => entry.generationId)).toEqual([
      first.generationId,
    ]);
    expect((await store.search(binding, 'refund', 1))[0]).toMatchObject({
      effectiveAt: '2026-01-01T00:00:00.000Z',
      documentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    await expect(store.buildCandidate(binding, [])).rejects.toThrow('no documents');
    expect(await store.activeGeneration(binding)).toBe(first.generationId);

    const next = await store.buildCandidate(binding, [document('shipping only', 'v2')]);
    await expect(
      store.activate(binding, next.generationId, {
        generationId: undefined,
        revision: 0,
      }),
    ).rejects.toThrow('compare-and-set');
    expect(await store.activeGeneration(binding)).toBe(first.generationId);

    await store.activate(binding, next.generationId, await store.publication(binding));
    expect(await store.activeGeneration(binding)).toBe(next.generationId);
    await store.rollback(binding, first.generationId);
    expect(await store.activeGeneration(binding)).toBe(first.generationId);
    // The pointer again names the first generation, but its monotonic
    // revision changed. A writer fetched at revision 1 cannot exploit that
    // ABA shape to replace the rollback result.
    await expect(
      store.activate(binding, next.generationId, {
        generationId: first.generationId,
        revision: 1,
      }),
    ).rejects.toThrow('compare-and-set');
    expect(
      await store.search({ ...binding, tenantId: 'tenant-b', providerAccountId: 'account-b' }, 'refund', 5),
    ).toEqual([]);

    await expect(
      store.buildCandidate(binding, [{ ...document('missing effective time', 'v3'), effectiveAt: undefined }]),
    ).rejects.toThrow('effective time');
    await expect(store.buildCandidate(binding, [document('one', 'v4'), document('two', 'v5')])).rejects.toThrow(
      'conflicting source versions',
    );
  });

  it('normalizes offset expiry instants and excludes evidence at the exact expiry boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T22:00:00.000Z'));
    const offsetBinding = {
      ...binding,
      tenantId: `offset-${crypto.randomUUID()}`,
      providerAccountId: `offset-${crypto.randomUUID()}`,
    };
    const store = new KnowledgePublicationStore(createClient({ url: process.env.DATABASE_URL! }));
    const candidate = await store.buildCandidate(offsetBinding, [
      {
        ...document('offset expiry', 'offset-v1'),
        expiresAt: '2026-09-06T03:00:00+03:00',
      },
    ]);
    await store.activate(offsetBinding, candidate.generationId, {
      generationId: undefined,
      revision: 0,
    });
    expect((await store.search(offsetBinding, 'offset', 1))[0]?.expiresAt).toBe('2026-09-06T00:00:00.000Z');
    vi.setSystemTime(new Date('2026-09-06T00:00:00.000Z'));
    expect(await store.search(offsetBinding, 'offset', 1)).toEqual([]);
  });

  it('rejects duplicate and conflicting payloads for one provider/source version identity', async () => {
    const identityBinding = {
      ...binding,
      tenantId: `identity-${crypto.randomUUID()}`,
      providerAccountId: `identity-${crypto.randomUUID()}`,
    };
    const store = new KnowledgePublicationStore(createClient({ url: process.env.DATABASE_URL! }));
    const canonical = document('refunds require approval', 'v1');

    await expect(store.buildCandidate(identityBinding, [canonical, { ...canonical }])).rejects.toThrow(
      'duplicate document identity',
    );
    await expect(
      store.buildCandidate(identityBinding, [canonical, document('refunds are automatically approved', 'v1')]),
    ).rejects.toThrow('conflicting source/version payload');
  });

  it('keeps a known-good publication active when activation or rollback finds expired evidence', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T22:00:00.000Z'));
    const expiryBinding = {
      ...binding,
      tenantId: `expiry-${crypto.randomUUID()}`,
      providerAccountId: `expiry-${crypto.randomUUID()}`,
    };
    const store = new KnowledgePublicationStore(createClient({ url: process.env.DATABASE_URL! }));
    const knownGood = await store.buildCandidate(expiryBinding, [document('refunds require approval', 'v1')]);
    await store.activate(expiryBinding, knownGood.generationId, {
      generationId: undefined,
      revision: 0,
    });

    const expiresBeforeActivation = await store.buildCandidate(expiryBinding, [
      {
        ...document('expired before activation', 'v2'),
        expiresAt: '2026-09-05T22:00:05.000Z',
      },
    ]);
    const beforeRejectedActivation = await store.publication(expiryBinding);
    vi.setSystemTime(new Date('2026-09-05T22:00:05.000Z'));
    await expect(
      store.activate(expiryBinding, expiresBeforeActivation.generationId, await store.publication(expiryBinding)),
    ).rejects.toThrow('incomplete or inactive');
    expect(await store.publication(expiryBinding)).toEqual(beforeRejectedActivation);

    vi.setSystemTime(new Date('2026-09-05T22:00:06.000Z'));
    const expiresBeforeRollback = await store.buildCandidate(expiryBinding, [
      {
        ...document('expires before rollback', 'v3'),
        expiresAt: '2026-09-05T22:00:10.000Z',
      },
    ]);
    await store.activate(expiryBinding, expiresBeforeRollback.generationId, await store.publication(expiryBinding));
    const replacement = await store.buildCandidate(expiryBinding, [
      document('refunds require a documented review', 'v4'),
    ]);
    await store.activate(expiryBinding, replacement.generationId, await store.publication(expiryBinding));

    vi.setSystemTime(new Date('2026-09-05T22:00:10.000Z'));
    const beforeRejectedRollback = await store.publication(expiryBinding);
    await expect(store.rollback(expiryBinding, expiresBeforeRollback.generationId)).rejects.toThrow(
      'incomplete or inactive',
    );
    expect(await store.publication(expiryBinding)).toEqual(beforeRejectedRollback);
    expect((await store.search(expiryBinding, 'documented review', 1))[0]?.generationId).toBe(replacement.generationId);
  });

  it('makes every sealed authority field and document row append-only', async () => {
    const tamperBinding = {
      ...binding,
      tenantId: `tamper-${crypto.randomUUID()}`,
      providerAccountId: `tamper-${crypto.randomUUID()}`,
    };
    const client = createClient({ url: process.env.DATABASE_URL! });
    const store = new KnowledgePublicationStore(client);
    const knownGood = await store.buildCandidate(tamperBinding, [document('refunds require approval', 'v1')]);
    await store.activate(tamperBinding, knownGood.generationId, {
      generationId: undefined,
      revision: 0,
    });
    const expected = await store.publication(tamperBinding);
    const candidateDocuments = () => [
      {
        ...document('two document candidate one', 'v2'),
        source: 'policy://one',
      },
      {
        ...document('two document candidate two', 'v2'),
        source: 'policy://two',
      },
    ];
    const rejectSealedMutation = async (alter: (generationId: string) => Promise<unknown>, message: string) => {
      const candidate = await store.buildCandidate(tamperBinding, candidateDocuments());
      await expect(alter(candidate.generationId)).rejects.toThrow(message);
      expect(await store.publication(tamperBinding)).toEqual(expected);
    };

    await rejectSealedMutation(async generationId => {
      await client.execute({
        sql: 'DELETE FROM support_knowledge_documents WHERE generation_id = ? AND source = ?',
        args: [generationId, 'policy://one'],
      });
    }, 'sealed knowledge documents are immutable');
    await rejectSealedMutation(async generationId => {
      await client.execute({
        sql: 'INSERT INTO support_knowledge_documents(generation_id, source, title, text, version, document_hash, effective_at, indexed_at, expires_at, provider_kind, provider_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
        args: [
          generationId,
          'policy://added',
          'Added policy',
          'added after candidate build',
          'v2',
          'forged',
          '2026-01-01T00:00:00.000Z',
          '2026-09-05T22:00:00.000Z',
          tamperBinding.providerKind,
          tamperBinding.providerAccountId,
        ],
      });
    }, 'sealed knowledge documents are immutable');
    await rejectSealedMutation(async generationId => {
      await client.execute({
        sql: 'UPDATE support_knowledge_documents SET text = ? WHERE generation_id = ? AND source = ?',
        args: ['refunds are automatically approved', generationId, 'policy://one'],
      });
    }, 'sealed knowledge documents are immutable');

    for (const [column, value] of [
      ['account_key', 'foreign-account-key'],
      ['tenant_id', 'foreign-tenant'],
      ['provider_kind', 'foreign-provider'],
      ['provider_account_id', 'foreign-account'],
      ['expected_document_count', 99],
      ['manifest_hash', 'f'.repeat(64)],
      ['sealed_at', '2026-09-06T00:00:00.000Z'],
    ] as const) {
      await rejectSealedMutation(async generationId => {
        await client.execute({
          sql: `UPDATE support_knowledge_generations SET ${column} = ? WHERE id = ?`,
          args: [value, generationId],
        });
      }, 'sealed knowledge generation authority is immutable');
    }
  });

  it('rejects coordinated row, count, manifest, and ownership substitutions before activation', async () => {
    const tamperBinding = {
      ...binding,
      tenantId: `coordinated-${crypto.randomUUID()}`,
      providerAccountId: `coordinated-${crypto.randomUUID()}`,
    };
    const client = createClient({ url: process.env.DATABASE_URL! });
    const store = new KnowledgePublicationStore(client);
    const knownGood = await store.buildCandidate(tamperBinding, [document('known good policy', 'v1')]);
    await store.activate(tamperBinding, knownGood.generationId, {
      generationId: undefined,
      revision: 0,
    });
    const expected = await store.publication(tamperBinding);
    const target = await store.buildCandidate(tamperBinding, [
      { ...document('target one', 'v2'), source: 'policy://target-one' },
      { ...document('target two', 'v2'), source: 'policy://target-two' },
    ]);
    const donor = await store.buildCandidate(tamperBinding, [
      { ...document('donor one', 'v3'), source: 'policy://donor-one' },
      { ...document('donor two', 'v3'), source: 'policy://donor-two' },
    ]);

    await expect(
      client.batch(
        [
          {
            sql: 'UPDATE support_knowledge_documents SET generation_id = ? WHERE generation_id = ?',
            args: [target.generationId, donor.generationId],
          },
          {
            sql: 'UPDATE support_knowledge_generations SET expected_document_count = ?, manifest_hash = ? WHERE id = ?',
            args: [2, 'd'.repeat(64), target.generationId],
          },
        ],
        'write',
      ),
    ).rejects.toThrow('sealed knowledge documents are immutable');
    expect(await store.publication(tamperBinding)).toEqual(expected);

    await expect(
      client.batch(
        [
          {
            sql: 'INSERT INTO support_knowledge_documents(generation_id, source, title, text, version, document_hash, effective_at, indexed_at, expires_at, provider_kind, provider_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
            args: [
              target.generationId,
              'policy://added',
              'Added policy',
              'added after seal',
              'v2',
              'a'.repeat(64),
              '2026-01-01T00:00:00.000Z',
              '2026-09-05T22:00:00.000Z',
              tamperBinding.providerKind,
              tamperBinding.providerAccountId,
            ],
          },
          {
            sql: 'UPDATE support_knowledge_generations SET expected_document_count = ?, manifest_hash = ? WHERE id = ?',
            args: [3, 'b'.repeat(64), target.generationId],
          },
        ],
        'write',
      ),
    ).rejects.toThrow('sealed knowledge documents are immutable');
    expect(await store.publication(tamperBinding)).toEqual(expected);

    await expect(
      client.batch(
        [
          {
            sql: 'UPDATE support_knowledge_generations SET account_key = ?, tenant_id = ?, provider_kind = ?, provider_account_id = ?, expected_document_count = ?, manifest_hash = ? WHERE id = ?',
            args: [
              'foreign-key',
              'foreign-tenant',
              'foreign-provider',
              'foreign-account',
              2,
              'c'.repeat(64),
              target.generationId,
            ],
          },
          {
            sql: 'UPDATE support_knowledge_documents SET generation_id = ? WHERE generation_id = ?',
            args: [target.generationId, donor.generationId],
          },
        ],
        'write',
      ),
    ).rejects.toThrow('sealed knowledge generation authority is immutable');
    await expect(store.activate(tamperBinding, target.generationId, expected)).resolves.toMatchObject({
      generationId: target.generationId,
    });
  });

  it('keeps rollback usable because historical sealed generations remain intact', async () => {
    const rollbackBinding = {
      ...binding,
      tenantId: `rollback-integrity-${crypto.randomUUID()}`,
      providerAccountId: `rollback-integrity-${crypto.randomUUID()}`,
    };
    const client = createClient({ url: process.env.DATABASE_URL! });
    const store = new KnowledgePublicationStore(client);
    const historical = await store.buildCandidate(rollbackBinding, [document('historical refund policy', 'v1')]);
    await store.activate(rollbackBinding, historical.generationId, {
      generationId: undefined,
      revision: 0,
    });
    const current = await store.buildCandidate(rollbackBinding, [document('current refund policy', 'v2')]);
    await store.activate(rollbackBinding, current.generationId, await store.publication(rollbackBinding));
    await expect(
      client.execute({
        sql: 'UPDATE support_knowledge_documents SET text = ? WHERE generation_id = ?',
        args: ['tampered historical policy', historical.generationId],
      }),
    ).rejects.toThrow('sealed knowledge documents are immutable');
    await store.rollback(rollbackBinding, historical.generationId);
    expect(await store.publication(rollbackBinding)).toMatchObject({
      generationId: historical.generationId,
      revision: 3,
    });
  });
});
