import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { answerConstraintsSchema } from './question.ts';

const fieldsSchema = z
  .object({
    question: z.int().nonnegative().max(16383),
    required: z.int().nonnegative().max(16383).optional(),
    maxChars: z.int().nonnegative().max(16383).optional(),
    id: z.int().nonnegative().max(16383).optional(),
    type: z.int().nonnegative().max(16383).optional(),
    options: z.int().nonnegative().max(16383).optional(),
    section: z.int().nonnegative().max(16383).optional(),
    instructions: z.int().nonnegative().max(16383).optional(),
    response: z.int().nonnegative().max(16383).optional(),
    explanation: z.int().nonnegative().max(16383).optional(),
    evidence: z.int().nonnegative().max(16383).optional(),
    yes: z.int().nonnegative().max(16383).optional(),
    no: z.int().nonnegative().max(16383).optional(),
    not_applicable: z.int().nonnegative().max(16383).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const a = Object.values(v);
    if (new Set(a).size !== a.length) c.addIssue({ code: 'custom', message: 'Field columns must be distinct.' });
  });
export const regionMappingSchema = z
  .object({
    regionId: id,
    startRow: z.int().nonnegative(),
    endRow: z.int().nonnegative(),
    fields: fieldsSchema,
    answerType: z.enum(['boolean', 'single_choice', 'free_text']).optional(),
    answerConstraints: answerConstraintsSchema.optional(),
    section: z.string().max(4000).optional(),
    instructions: z.string().max(4000).optional(),
  })
  .strict()
  .refine(v => v.endRow >= v.startRow);
export const mappingSchema = z
  .object({
    contractVersion: z.literal(1),
    sourceSha256: hash,
    adapterKey: id,
    adapterVersion: z.string().min(1).max(40),
    profile: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_.-]*$/),
    profileVersion: z.literal(1),
    regions: z.array(regionMappingSchema).min(1).max(2000),
    exclusions: z
      .array(
        z
          .object({
            regionId: id,
            startRow: z.int().nonnegative(),
            endRow: z.int().nonnegative(),
            reason: z.string().min(1).max(1000),
          })
          .strict()
          .refine(v => v.endRow >= v.startRow),
      )
      .max(4000),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.regions.map(r => r.regionId)).size !== v.regions.length)
      c.addIssue({ code: 'custom', message: 'Map each region once.' });
  });
export type ConfirmedInputMapping = z.infer<typeof mappingSchema>;
