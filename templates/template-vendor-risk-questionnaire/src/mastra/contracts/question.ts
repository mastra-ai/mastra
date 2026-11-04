import { z } from 'zod';
import { id, text } from './primitives.ts';
import { sourceLocatorSchema } from './source-locator.ts';

export const answerConstraintsSchema = z
  .object({
    required: z.boolean().optional(),
    maxChars: z.int().positive().optional(),
    options: z
      .array(z.object({ value: z.string().min(1).max(200), label: z.string().min(1).max(400) }).strict())
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.options && new Set(v.options.map(o => o.value)).size !== v.options.length)
      c.addIssue({ code: 'custom', message: 'Option values must be unique.' });
  });
export const questionSchema = z
  .object({
    id,
    originalQuestionId: z.string().min(1).max(160).optional(),
    originalText: z.string().min(1).max(4000),
    normalizedText: z.string().min(1).max(4000),
    order: z.int().nonnegative(),
    section: z.string().max(4000).optional(),
    instructions: z.string().max(4000).optional(),
    answerType: z.enum(['boolean', 'single_choice', 'free_text']),
    answerConstraints: answerConstraintsSchema,
    sourceLocators: z.array(sourceLocatorSchema).min(1).max(100),
    responseTargets: z
      .array(
        z
          .object({
            role: z.enum(['response', 'explanation', 'evidence', 'yes', 'no', 'not_applicable']),
            locator: sourceLocatorSchema,
          })
          .strict(),
      )
      .max(100)
      .optional(),
    untrustedExistingResponse: z
      .array(
        z.object({ text, formulaLiteral: z.string().max(2_000_000).optional(), locator: sourceLocatorSchema }).strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.normalizedText !== v.originalText.replace(/\s+/g, ' ').trim())
      c.addIssue({ code: 'custom', message: 'Only whitespace normalization is allowed.' });
    if (v.answerType !== 'free_text' && (!v.answerConstraints.options || v.answerConstraints.options.length < 2))
      c.addIssue({ code: 'custom', message: 'Choice and boolean questions require explicit options.' });
    if (v.answerType === 'boolean' && v.answerConstraints.options) {
      const values = v.answerConstraints.options.map(o => o.value.toLowerCase());
      if (!values.some(v => ['yes', 'true', '1'].includes(v)) || !values.some(v => ['no', 'false', '0'].includes(v)))
        c.addIssue({
          code: 'custom',
          message:
            'Boolean options require explicit positive and negative values; additional supplied choices are preserved.',
        });
    }
    if (v.answerType === 'free_text' && v.answerConstraints.options)
      c.addIssue({ code: 'custom', message: 'Free text cannot carry choice options.' });
  });
export type CanonicalQuestion = z.infer<typeof questionSchema>;
