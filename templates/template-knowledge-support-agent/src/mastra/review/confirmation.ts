import { z } from 'zod';
import { actorIdSchema } from '../identity.ts';
const referencePrefix = 'sc1.';
// A JSON-escaped UTF-16 code unit can take six bytes before base64url encoding.
const maxReferenceLength = 2048;
export const confirmationReferenceString = z
  .string()
  .max(maxReferenceLength)
  .regex(/^sc1\.[A-Za-z0-9_-]+$/u);

const text = z
  .string()
  .trim()
  .min(10)
  .max(1500)
  .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u);
export const confirmationInputSchema = z
  .object({
    threadId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/u),
    observation: text,
    outcome: text,
  })
  .strict();
export const confirmationMetadataSchema = confirmationInputSchema
  .extend({
    version: z.literal(1),
    sourceActorId: actorIdSchema,
    confirmedAt: z.iso.datetime(),
  })
  .strict();
const locatorSchema = z
  .object({
    threadId: confirmationInputSchema.shape.threadId,
    messageId: z.uuid(),
    sourceActorId: actorIdSchema,
  })
  .strict();
export function confirmationText(input: z.infer<typeof confirmationInputSchema>) {
  return `Technician confirmation\nObservation: ${input.observation}\nOutcome: ${input.outcome}`;
}
function serializeLocator(locator: z.infer<typeof locatorSchema>) {
  return referencePrefix + Buffer.from(JSON.stringify(locator)).toString('base64url');
}
export function encodeConfirmationReference(locator: z.infer<typeof locatorSchema>) {
  return confirmationReferenceString.parse(serializeLocator(locatorSchema.parse(locator)));
}
export function decodeConfirmationReference(reference: string) {
  confirmationReferenceString.parse(reference);
  const locator = locatorSchema.parse(
    JSON.parse(Buffer.from(reference.slice(referencePrefix.length), 'base64url').toString('utf8')),
  );
  if (serializeLocator(locator) !== reference) throw new Error('Invalid confirmation reference');
  return locator;
}
export const confirmationReferenceSchema = z.string().transform((value, context) => {
  try {
    return decodeConfirmationReference(value);
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid confirmation reference' });
    return z.NEVER;
  }
});
