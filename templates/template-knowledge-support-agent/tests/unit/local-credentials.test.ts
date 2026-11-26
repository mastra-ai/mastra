import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadCredentials } from '../../src/mastra/server/access.ts';

test('local credential loading requires and enforces the configured Studio role', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-support-credentials-'));
  const file = join(directory, 'access.json');
  const credential = {
    token: 'synthetic-token-for-credential-test',
    expiresAt: Date.now() + 60_000,
    profile: { id: 'profile', actorId: 'actor', tenantId: 'tenant', customerId: 'customer', role: 'case-worker' },
  };
  try {
    await writeFile(file, JSON.stringify([credential]), { mode: 0o600 });
    assert.deepEqual(loadCredentials(file, 'case-worker'), [credential]);
    assert.throws(() => loadCredentials(file, undefined), /A local Studio role is required/u);

    const expired = { ...credential, expiresAt: 0 };
    const otherProfile = { ...credential.profile, id: 'other-profile', customerId: 'other-customer' };
    await writeFile(file, JSON.stringify([expired, { ...credential, profile: otherProfile }]));
    assert.throws(() => loadCredentials(file, 'case-worker'), /Duplicate local credential token/u);

    const rotation = { ...expired, token: 'previous-synthetic-credential-token' };
    await writeFile(file, JSON.stringify([rotation, credential]));
    assert.deepEqual(loadCredentials(file, 'case-worker'), [rotation, credential]);

    credential.profile.role = 'reviewer';
    await writeFile(file, JSON.stringify([credential]));
    assert.throws(() => loadCredentials(file, 'case-worker'), /Invalid local role/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
