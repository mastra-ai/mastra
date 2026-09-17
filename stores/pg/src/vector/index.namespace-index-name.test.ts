import { describe, expect, it } from 'vitest';

import { PgVector } from '.';

describe('PgVector namespace index names', () => {
  it('preserves the Node-generated SHA-256 suffix for long index names', async () => {
    const vector = Object.create(PgVector.prototype) as PgVector;

    await expect(
      (vector as unknown as { getNamespaceIndexName(indexName: string): Promise<string> }).getNamespaceIndexName(
        'tenant_vectors_with_an_intentionally_long_name_for_namespace_migration_hash',
      ),
    ).resolves.toBe('tenant_vectors_with_an__ns_9dc5d6c2dc1a14c67cf786975b62fe1a_idx');
  });
});
