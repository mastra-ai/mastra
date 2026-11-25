import assert from 'node:assert/strict';
import test from 'node:test';
import { principals, resourceId, validateProfile } from '../../src/mastra/identity.ts';
import { createHostedIdentity, hasHostedOAuthConfiguration } from '../../src/mastra/server/hosted-identity.ts';
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

test('an audience alone selects hosted OAuth and requires the remaining settings', t => {
  const keys = [
    'SUPPORT_OAUTH_INTROSPECTION_URL',
    'SUPPORT_OAUTH_INTROSPECTION_TOKEN',
    'SUPPORT_OAUTH_ISSUER',
    'SUPPORT_OAUTH_AUDIENCE',
  ];
  const original = keys.map(key => [key, process.env[key]] as const);
  t.after(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  for (const key of keys) delete process.env[key];
  assert.equal(hasHostedOAuthConfiguration(), false);

  process.env.SUPPORT_OAUTH_AUDIENCE = 'support-test';
  assert.equal(hasHostedOAuthConfiguration(), true);
  assert.throws(createHostedIdentity, /requires OAuth introspection URL, service token, issuer and audience/u);
});
