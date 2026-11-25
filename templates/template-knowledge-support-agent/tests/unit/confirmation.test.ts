import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confirmationInputSchema,
  confirmationMetadataSchema,
  confirmationReferenceSchema,
  decodeConfirmationReference,
  encodeConfirmationReference,
} from '../../src/mastra/review/confirmation.ts';

test('confirmation references support long Unicode actors and reject ambiguous locators', () => {
  const locator = {
    threadId: 't'.repeat(100),
    messageId: '00000000-0000-4000-8000-000000000001',
    sourceActorId: '界'.repeat(200),
  };
  const reference = encodeConfirmationReference(locator);
  assert.ok(reference.length > 1000);
  assert.deepEqual(confirmationReferenceSchema.parse(reference), locator);
  assert.deepEqual(decodeConfirmationReference(reference), locator);
  for (const invalid of [
    reference + '=',
    reference + '\n',
    'sc1.' + 'a'.repeat(2048),
    'sc1.' + Buffer.from(JSON.stringify({ ...locator, actorId: 'claimed' })).toString('base64url'),
  ])
    assert.equal(confirmationReferenceSchema.safeParse(invalid).success, false);
  const payload = {
    threadId: 'thread',
    observation: 'Observed adapter configuration.',
    outcome: 'The authorized check succeeded.',
  };
  assert.equal(confirmationInputSchema.safeParse(payload).success, true);
  assert.equal(confirmationInputSchema.safeParse({ ...payload, sourceActorId: 'claimed' }).success, false);
  for (const invalid of [' padded', 'padded ', 'control\u0001'])
    assert.throws(() => encodeConfirmationReference({ ...locator, sourceActorId: invalid }));
  const sourceActorId = '\uD800'.repeat(200);
  const metadata = confirmationMetadataSchema.parse({
    ...payload,
    version: 1,
    sourceActorId,
    confirmedAt: '2026-11-20T00:00:00Z',
  });
  const escaped = { ...locator, sourceActorId: metadata.sourceActorId };
  assert.deepEqual(confirmationReferenceSchema.parse(encodeConfirmationReference(escaped)), escaped);
});
