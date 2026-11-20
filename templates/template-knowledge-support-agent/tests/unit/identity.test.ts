import assert from 'node:assert/strict';
import test from 'node:test';
import { principals, resourceId, validateProfile } from '../../src/mastra/identity.ts';
import type { Profile } from '../../src/mastra/identity.ts';

test('profile tuples and literal percent identifiers cannot alias another owner', () => {
  const base: Profile = {
    id: 'test-profile',
    actorId: 'actor',
    tenantId: 'tenant',
    customerId: 'customer',
  };
  const variants = [
    base,
    { ...base, customerId: 'store:1' },
    { ...base, customerId: 'store%3A1' },
    { ...base, actorId: 'other' },
    { ...base, tenantId: 'other' },
  ];
  assert.equal(new Set(variants.map(resourceId)).size, variants.length);
  assert.notEqual(principals(variants[1]!)[1], principals(variants[2]!)[1]);
  assert.throws(() => validateProfile({ ...base, actorId: '\n' }));
  assert.throws(() => validateProfile({ ...base, customerId: '' }));
});
