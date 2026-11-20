import assert from 'node:assert/strict';
import test from 'node:test';
import {
  confirmationInputSchema,
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
  assert.ok(reference.length > 1000 && reference.length <= 1280);
  assert.equal(confirmationReferenceSchema.safeParse(reference).success, true);
  assert.deepEqual(decodeConfirmationReference(reference), locator);
  for (const invalid of [
    reference + '=',
    reference + '\n',
    'sc1.' + 'a'.repeat(1280),
    'sc1.' + Buffer.from(JSON.stringify({ ...locator, actorId: 'claimed' })).toString('base64url'),
  ])
    assert.equal(confirmationReferenceSchema.safeParse(invalid).success, false);
  assert.equal(
    confirmationInputSchema.safeParse({
      threadId: 'thread',
      observation: 'Observed adapter configuration.',
      outcome: 'The authorized check succeeded.',
      sourceActorId: 'claimed',
    }).success,
    false,
  );
});
