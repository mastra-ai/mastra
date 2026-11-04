import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { sourceLocatorSchema } from './source-locator.ts';
import { answerConstraintsSchema } from './question.ts';

export const writeTargetSchema = z
  .object({
    role: z.enum(['response', 'explanation', 'evidence', 'yes', 'no', 'not_applicable']),
    locator: sourceLocatorSchema,
    part: z.string().min(1).max(160),
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
    originalXml: z.string().max(2_000_000),
    expectedText: z.string().max(2_000_000),
    replacementConsent: z.boolean(),
    mode: z.enum(['xlsx.cell', 'docx.text', 'docx.insert']),
    segments: z
      .array(
        z
          .object({
            start: z.int().nonnegative(),
            end: z.int().nonnegative(),
            mode: z.enum(['text', 'empty-text', 'empty-paragraph', 'run']),
          })
          .strict(),
      )
      .max(100)
      .optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.originalXml.length !== v.end - v.start ||
      v.segments?.some(
        (s, i) =>
          s.start < v.start ||
          s.end > v.end ||
          s.end < s.start ||
          (i > 0 && (s.start < v.segments![i - 1]!.end || s.start === v.segments![i - 1]!.start)),
      )
    )
      c.addIssue({ code: 'custom', message: 'Segments must remain inside the exact authorized span.' });
    if (
      v.end < v.start ||
      (v.mode === 'docx.insert' && !v.segments && (v.start !== v.end || v.originalXml !== '')) ||
      (v.expectedText.length > 0 && !v.replacementConsent)
    )
      c.addIssue({ code: 'custom', message: 'An exact span and explicit prefilled replacement consent are required.' });
  });
const fields = {
  schemaVersion: z.literal(2),
  sourceId: id,
  sourceSha256: hash,
  profile: z.string().min(1).max(80),
  profileVersion: z.literal(1),
  mappingDigest: hash,
  questions: z
    .array(
      z
        .object({
          id,
          order: z.int().nonnegative(),
          constraints: answerConstraintsSchema,
          targets: z.array(writeTargetSchema).min(1).max(6),
        })
        .strict(),
    )
    .min(1)
    .max(100),
};
export const writePlanSchema = z
  .discriminatedUnion('format', [
    z.object({ ...fields, format: z.literal('xlsx') }).strict(),
    z.object({ ...fields, format: z.literal('docx') }).strict(),
  ])
  .superRefine((v, c) => {
    if (new Set(v.questions.map(q => q.id)).size !== v.questions.length)
      c.addIssue({ code: 'custom', message: 'Unique question identities required.' });
    const targets = v.questions.flatMap(q => q.targets);
    if (
      !(v.format === 'xlsx' ? v.profile === 'xlsx.table.v1' : ['docx.table.v1', 'docx.blocks.v1'].includes(v.profile))
    )
      c.addIssue({ code: 'custom', message: 'Completion format and supported profile must agree.' });
    for (const [i, q] of v.questions.entries()) {
      const roles = q.targets.map(t => t.role);
      if (
        q.order !== i ||
        new Set(roles).size !== roles.length ||
        (!roles.includes('response') &&
          !(roles.includes('yes') && roles.includes('no') && roles.includes('explanation')))
      )
        c.addIssue({ code: 'custom', message: 'Ordered questions require representable response destinations.' });
      if (q.constraints.options && !roles.includes('explanation'))
        c.addIssue({
          code: 'custom',
          message: 'Choice destinations require an explanation field for qualifications and gaps.',
          params: { code: 'EXPLANATION_FIELD_REQUIRED' },
        });
    }
    for (const [i, t] of targets.entries()) {
      if (
        t.locator.sourceId !== v.sourceId ||
        t.locator.sourceSha256 !== v.sourceSha256 ||
        (v.format === 'xlsx') !== (t.mode === 'xlsx.cell') ||
        (v.format === 'xlsx'
          ? t.locator.kind !== 'xlsx.cell'
          : !['docx.table_cell', 'docx.paragraph'].includes(t.locator.kind))
      )
        c.addIssue({ code: 'custom', message: 'Source and format bindings must agree.' });
      for (const other of targets.slice(i + 1))
        if (
          t.part === other.part &&
          ((t.start === other.start &&
            !(
              t.mode === 'xlsx.cell' &&
              other.mode === 'xlsx.cell' &&
              t.start === t.end &&
              other.start === other.end &&
              JSON.stringify(t.locator) !== JSON.stringify(other.locator)
            )) ||
            (t.start < other.end && other.start < t.end))
        )
          c.addIssue({ code: 'custom', message: 'Write targets must not overlap.' });
    }
  });
export type DocumentWritePlan = z.infer<typeof writePlanSchema>;
export type WriteTarget = z.infer<typeof writeTargetSchema>;
export const documentPublicationSchema = z
  .object({
    schemaVersion: z.literal(2),
    runId: id,
    revision: z.int().nonnegative(),
    approvalId: id,
    sourceSha256: hash,
    mappingDigest: hash,
    writePlanDigest: hash,
    projectionDigest: hash,
    format: z.enum(['xlsx', 'docx']),
    quality: z.enum(['complete', 'delivered_with_gaps']),
    files: z
      .array(
        z
          .object({ name: z.enum(['answered.xlsx', 'answered.docx']), sha256: hash, bytes: z.int().positive() })
          .strict(),
      )
      .length(1),
  })
  .strict()
  .refine(v => v.files[0]!.name === `answered.${v.format}`, 'Output format must agree.');

export const documentResultSchema = z
  .object({
    path: z.string().min(1).refine(isAbsolute, 'An absolute output path is required.'),
    manifest: documentPublicationSchema,
  })
  .strict();
