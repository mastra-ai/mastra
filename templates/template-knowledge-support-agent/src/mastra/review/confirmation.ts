import { z } from 'zod';

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
    sourceActorId: z.string().min(1).max(200),
    confirmedAt: z.iso.datetime(),
  })
  .strict();
const locatorSchema = z
  .object({
    threadId: confirmationInputSchema.shape.threadId,
    messageId: z.uuid(),
    sourceActorId: z.string().min(1).max(200),
  })
  .strict();
export function confirmationText(input: z.infer<typeof confirmationInputSchema>) {
  return `Technician confirmation\nObservation: ${input.observation}\nOutcome: ${input.outcome}`;
}
export function encodeConfirmationReference(locator: z.infer<typeof locatorSchema>) {
  const reference = `sc1.${Buffer.from(JSON.stringify(locatorSchema.parse(locator))).toString('base64url')}`;
  // 200 UTF-16 actor characters may occupy 600 UTF-8 bytes, plus the bounded IDs and JSON.
  if (reference.length > 1280) throw new Error('Confirmation reference exceeds its bound');
  return reference;
}
export function decodeConfirmationReference(reference: string) {
  if (!/^sc1\.[A-Za-z0-9_-]{1,1276}$/u.test(reference)) throw new Error('Invalid confirmation reference');
  const locator = locatorSchema.parse(JSON.parse(Buffer.from(reference.slice(4), 'base64url').toString('utf8')));
  if (encodeConfirmationReference(locator) !== reference) throw new Error('Invalid confirmation reference');
  return locator;
}
export const confirmationReferenceSchema = z
  .string()
  .max(1280)
  .refine(value => {
    try {
      decodeConfirmationReference(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid confirmation reference');
