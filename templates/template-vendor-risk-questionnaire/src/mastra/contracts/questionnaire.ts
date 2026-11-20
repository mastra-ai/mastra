import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { questionSchema } from './question.ts';

export const questionnaireSchema = z
  .object({
    schemaVersion: z.literal(1),
    questionnaireId: id,
    organizationId: id,
    title: z.string().min(1).max(300),
    inputProvenance: z
      .object({
        sourceId: id,
        sourceSha256: hash,
        adapterKey: id,
        adapterVersion: z.string().min(1).max(40),
        contractVersion: z.literal(1),
        profileVersion: z.literal(1),
        profile: z.string().max(80),
        mappingDigest: hash,
      })
      .strict(),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.questions.map(q => q.id)).size !== v.questions.length)
      c.addIssue({ code: 'custom', message: 'Duplicate question IDs.' });
    for (const [i, q] of v.questions.entries()) {
      if (q.order !== i) c.addIssue({ code: 'custom', message: 'Question order must be contiguous.' });
      for (const l of [
        ...q.sourceLocators,
        ...(q.responseTargets?.map(t => t.locator) ?? []),
        ...(q.untrustedExistingResponse?.map(t => t.locator) ?? []),
      ])
        if (l.sourceId !== v.inputProvenance.sourceId || l.sourceSha256 !== v.inputProvenance.sourceSha256)
          c.addIssue({ code: 'custom', message: 'Locator source mismatch.' });
    }
  });
export type QuestionnaireInput = z.infer<typeof questionnaireSchema>;
