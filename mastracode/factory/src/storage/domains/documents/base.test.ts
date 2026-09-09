import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import type { FactoryDocumentSnapshot } from './base.js';
import { FACTORY_DOC_KINDS } from './catalog.js';

const scope = { orgId: 'org-1', factoryProjectId: 'project-1' };

function fullSnapshot(overrides: Partial<Record<string, Partial<FactoryDocumentSnapshot>>> = {}) {
  return FACTORY_DOC_KINDS.map(
    (definition): FactoryDocumentSnapshot => ({
      kind: definition.kind,
      path: definition.defaultPath,
      status: 'missing',
      ...overrides[definition.kind],
    }),
  );
}

describe('FactoryDocumentsStorage', () => {
  it('stores a full snapshot in catalog order and lists it without bodies', async () => {
    const seed = await createFactoryStorageForTests();
    const rows = await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: 'abc123',
      manifestStatus: 'ok',
      documents: fullSnapshot({
        architecture: {
          status: 'present',
          title: 'System Architecture',
          summary: 'Three services behind one gateway.',
          content: '# System Architecture\n\nThree services behind one gateway.',
          contentHash: 'hash-1',
          sizeBytes: 58,
        },
      }),
    });

    expect(rows.map(row => row.kind)).toEqual(FACTORY_DOC_KINDS.map(definition => definition.kind));
    const architecture = rows.find(row => row.kind === 'architecture');
    expect(architecture).toMatchObject({
      status: 'present',
      title: 'System Architecture',
      sourceRef: 'origin/main',
      sourceSha: 'abc123',
      manifestStatus: 'ok',
    });
    expect(architecture).not.toHaveProperty('content');
    expect(rows.find(row => row.kind === 'glossary')).toMatchObject({ status: 'missing', title: null });

    const record = await seed.documents.getByKind(scope, 'architecture');
    expect(record?.content).toContain('Three services');
    expect(await seed.documents.getByPath(scope, 'docs/factory/architecture.md')).toEqual(record);
  });

  it('scopes reads to the org and project', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: null,
      manifestStatus: 'missing',
      documents: fullSnapshot(),
    });

    expect(await seed.documents.list({ orgId: 'org-2', factoryProjectId: 'project-1' })).toEqual([]);
    expect(await seed.documents.list({ orgId: 'org-1', factoryProjectId: 'project-2' })).toEqual([]);
    expect(await seed.documents.getByKind({ orgId: 'org-2', factoryProjectId: 'project-1' }, 'glossary')).toBeNull();
    expect(await seed.documents.syncState({ orgId: 'org-2', factoryProjectId: 'project-1' })).toBeNull();
  });

  it('replaces the previous snapshot, including a kind whose path moved', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: 'sha-1',
      manifestStatus: 'ok',
      documents: fullSnapshot({ architecture: { status: 'present', content: 'v1', path: 'docs/factory/arch.md' } }),
    });
    const rows = await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: 'sha-2',
      manifestStatus: 'ok',
      documents: fullSnapshot({
        architecture: { status: 'present', content: 'v2', path: 'docs/factory/architecture/overview.md' },
        glossary: { status: 'present', content: 'terms' },
      }),
    });

    expect(rows).toHaveLength(FACTORY_DOC_KINDS.length);
    expect(rows.every(row => row.sourceSha === 'sha-2')).toBe(true);
    expect(await seed.documents.getByPath(scope, 'docs/factory/arch.md')).toBeNull();
    expect((await seed.documents.getByKind(scope, 'architecture'))?.content).toBe('v2');
    expect((await seed.documents.getByKind(scope, 'glossary'))?.content).toBe('terms');
    expect(await seed.documents.syncState(scope)).toMatchObject({ sourceSha: 'sha-2', manifestStatus: 'ok' });
  });

  it('drops rows for kinds absent from the new snapshot', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: null,
      manifestStatus: 'missing',
      documents: fullSnapshot(),
    });
    const rows = await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: null,
      manifestStatus: 'missing',
      documents: fullSnapshot().slice(0, 2),
    });
    expect(rows).toHaveLength(2);
  });

  it('rejects snapshots with duplicate kinds or paths', async () => {
    const seed = await createFactoryStorageForTests();
    const base = { ...scope, sourceRef: 'origin/main', sourceSha: null, manifestStatus: 'ok' as const };
    await expect(
      seed.documents.replaceSnapshot({
        ...base,
        documents: [
          { kind: 'glossary', path: 'docs/factory/a.md', status: 'missing' },
          { kind: 'glossary', path: 'docs/factory/b.md', status: 'missing' },
        ],
      }),
    ).rejects.toThrow(/duplicate kind/);
    await expect(
      seed.documents.replaceSnapshot({
        ...base,
        documents: [
          { kind: 'glossary', path: 'docs/factory/a.md', status: 'missing' },
          { kind: 'personas', path: 'docs/factory/a.md', status: 'missing' },
        ],
      }),
    ).rejects.toThrow(/duplicate path/);
  });
});
