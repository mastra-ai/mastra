import { z } from 'zod';
import { leadSchema } from '../../contracts';
import { ownedPatchSchema } from '../../review/contracts';

const {
  presentationVersion: _version,
  stage: _stage,
  summary: _summary,
  overrideClassification: _classification,
  overrideReason: _reason,
  ...outputFields
} = ownedPatchSchema.shape;
/** Submitted input is separate from protected output and never authorizes a disposition. */
export const attioMetadataSchema = z.strictObject({
  version: z.literal(2),
  input: z.strictObject({ inquiry: leadSchema.shape.inquiry }).optional(),
  output: z
    .strictObject({
      ...outputFields,
      operationId: z.string().min(1),
      outputState: z.enum(['Pending', 'Applied']),
      appliedAssessmentId: z.uuid().nullable(),
    })
    .optional(),
});
export function parseAttioMetadata(value: unknown) {
  return attioMetadataSchema.parse(typeof value === 'string' ? JSON.parse(value) : value);
}
