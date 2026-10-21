import { z } from 'zod';
import { diagnosticSchema } from './diagnostic.ts';
import { questionSchema } from './question.ts';
import { mappingSchema } from './mapping.ts';

export const coverageSchema = z
  .object({
    discoveredCandidates: z.int().nonnegative(),
    emittedQuestions: z.int().nonnegative(),
    excludedCandidates: z.int().nonnegative(),
    excludedRegions: mappingSchema.shape.exclusions,
  })
  .strict()
  .refine(v => v.discoveredCandidates === v.emittedQuestions + v.excludedCandidates);
export const normalizationSchema = z
  .object({
    contractVersion: z.literal(1),
    status: z.enum(['ready', 'rejected']),
    questions: z.array(questionSchema).max(100),
    coverage: coverageSchema,
    diagnostics: z.array(diagnosticSchema).max(4000),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.questions.map(q => q.id)).size !== v.questions.length || v.questions.some((q, i) => q.order !== i))
      c.addIssue({ code: 'custom', message: 'Unique contiguous question identity/order required.' });
    if (
      v.status === 'ready' &&
      (v.diagnostics.some(d => d.severity === 'error') ||
        !v.questions.length ||
        v.coverage.emittedQuestions !== v.questions.length)
    )
      c.addIssue({ code: 'custom', message: 'Ready requires complete error-free output.' });
  });
export type NormalizationResult = z.infer<typeof normalizationSchema>;
