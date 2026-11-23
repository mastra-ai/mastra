import { z } from 'zod/v4';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../schema';

/**
 * The decision a caller returns for a tool call that requires approval.
 *
 * Both the streaming `tool-call-approval` chunk (`resumeSchema`) and the
 * persisted approval tool metadata advertise this schema, so it lives here as
 * the single source of truth: the plain loop and the durable/evented tool-call
 * steps all publish it, and a consumer must see the same schema no matter
 * which engine ran the agent.
 */
const approvalSchema = toStandardSchema(
  z.object({
    approved: z
      .boolean()
      .describe('Controls if the tool call is approved or not, should be true when approved and false when declined'),
    reason: z
      .string()
      .optional()
      .describe('Optional explanation for the decision, surfaced to the model when the tool call is declined'),
  }),
);

/**
 * `approvalSchema` serialised the way chunks and metadata carry it. Computed
 * once because `standardSchemaToJSONSchema` is deterministic, so every engine
 * publishes byte-identical JSON.
 */
export const approvalResumeSchema = JSON.stringify(standardSchemaToJSONSchema(approvalSchema));
