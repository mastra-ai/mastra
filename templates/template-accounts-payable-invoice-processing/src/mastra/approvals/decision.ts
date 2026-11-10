import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const configuredSigningKey = process.env.AP_WORKFLOW_SIGNING_KEY?.trim();
const secret = configuredSigningKey
  ? createHmac('sha256', configuredSigningKey).update('ap-human-approval-v1').digest()
  : randomBytes(32);
const DecisionPayloadSchema = z.object({
  runId: z.string().trim().min(1).max(200),
  invoiceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
  reviewerId: z.string().trim().min(1),
  decidedAt: z.string().datetime(),
});
export const HumanApprovalDecisionSchema = DecisionPayloadSchema.extend({
  approvalSignature: z.string().regex(/^[a-f0-9]{64}$/),
});

// Invalid resume attempts carry no authorization and leave the approval pending.
export const HumanApprovalAttemptSchema = z.unknown().transform(value => {
  const decision = HumanApprovalDecisionSchema.safeParse(value);
  return decision.success ? decision.data : null;
});

const signature = (payload: z.infer<typeof DecisionPayloadSchema>) =>
  createHmac('sha256', secret)
    .update(JSON.stringify(DecisionPayloadSchema.parse(payload)))
    .digest('hex');

// Server-only capability: never expose this signer as an agent tool or API.
export function signHumanApproval(input: Omit<z.input<typeof DecisionPayloadSchema>, 'decidedAt'>) {
  const payload = DecisionPayloadSchema.parse({ ...input, decidedAt: new Date().toISOString() });
  return { ...payload, approvalSignature: signature(payload) };
}

export function isHumanApproval(
  decision: z.infer<typeof HumanApprovalDecisionSchema>,
  runId: string,
  invoiceDigest: string,
) {
  const age = Date.now() - Date.parse(decision.decidedAt);
  if (decision.runId !== runId || decision.invoiceDigest !== invoiceDigest || age < -30_000 || age > 300_000)
    return false;
  const expected = Buffer.from(signature(decision), 'hex');
  const received = Buffer.from(decision.approvalSignature, 'hex');
  return received.length === expected.length && timingSafeEqual(expected, received);
}
