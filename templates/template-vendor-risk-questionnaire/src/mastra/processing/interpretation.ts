import { z } from 'zod';
import { interpretationSchema, type Interpretation } from '../contracts/answer.ts';
import type { CanonicalQuestion } from '../contracts/question.ts';
import { canonicalJson, sha256 } from '../intake/source.ts';

const field = z.enum(['text', 'instructions']);
const reference = z.string().regex(/^[a-p]{24}$/);
const sourceSpanSchema = z.object({ ref: reference, field, text: z.string().min(1).max(500) }).strict();
export type SourceSpan = z.infer<typeof sourceSpanSchema>;
// A bijective hex-to-letter encoding keeps the same 96-bit source binding while
// avoiding accidental numeric PII matches in trusted machine references.
export function opaqueReference(value: unknown) {
  return sha256(canonicalJson(value))
    .slice(0, 24)
    .replace(/[0-9]/g, digit => String.fromCharCode(103 + Number(digit)));
}
function chunks(text: string) {
  const parts: string[] = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 500, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1]!)) end--;
    parts.push(text.slice(offset, end));
    offset = end;
  }
  return parts;
}
function sentenceSpans(text: string) {
  const parts: string[] = [];
  let offset = 0;
  for (const match of text.matchAll(/[.!?;](?:\s+|$)|\r?\n+/gu)) {
    const end = match.index + match[0].length;
    parts.push(...chunks(text.slice(offset, end)));
    offset = end;
  }
  parts.push(...chunks(text.slice(offset)));
  return parts;
}
export function sourceCatalogue(question: CanonicalQuestion, scope: string) {
  const source = { text: question.originalText, instructions: question.instructions ?? '' };
  let parts = (['text', 'instructions'] as const).flatMap(field =>
    sentenceSpans(source[field]).map(text => ({ field, text })),
  );
  if (parts.length > 20)
    parts = (['text', 'instructions'] as const).flatMap(field => chunks(source[field]).map(text => ({ field, text })));
  const catalogue = parts.map((part, position) => ({
    ...part,
    ref: opaqueReference({ scope, questionId: question.id, source, position, ...part }),
  }));
  return z
    .array(sourceSpanSchema)
    .min(1)
    .max(20)
    .superRefine((value, ctx) => {
      if (
        new Set(value.map(span => span.ref)).size !== value.length ||
        (['text', 'instructions'] as const).some(
          field =>
            value
              .filter(span => span.field === field)
              .map(span => span.text)
              .join('') !== source[field],
        )
      )
        ctx.addIssue({ code: 'custom', message: 'Catalogue must uniquely cover complete immutable source fields.' });
    })
    .parse(catalogue);
}
// Candidate values are trusted source/profile values, never provider-owned authoritative strings.
export function interpretationChoices(
  question: CanonicalQuestion,
  catalogue: SourceSpan[],
  scope: {
    product: string;
    environment: string;
    domains: string[];
  },
) {
  const wording = `${question.originalText}\n${question.instructions ?? ''}`;
  const literals = [
    ...new Set([
      ...(wording.match(/[A-Za-z0-9][A-Za-z0-9._:-]*/g) ?? []),
      ...(wording.match(/\b[A-Za-z0-9]+(?:[._:-][A-Za-z0-9]+)*\b/g) ?? []),
    ]),
  ].filter(value => interpretationSchema.shape.product.safeParse(value).success);
  const unresolved = `unresolved-${opaqueReference({ questionId: question.id, wording })}`;
  const time = ['unspecified'];
  if (/\b(current|currently|now|present)\b/i.test(wording)) time.push('current');
  if (/\blast[ -]year\b/i.test(wording)) time.push('last-year');
  time.push(...literals.filter(value => /^(?:19|20)\d{2}(?:-\d{2}(?:-\d{2})?)?$/.test(value)));
  // Exact short spans and explicit source-bound uncertainty preserve other temporal qualifiers.
  time.push(...catalogue.map(s => s.text).filter(text => text.length <= 200), unresolved);
  return {
    domain: [...new Set([...scope.domains, ...literals, unresolved])],
    product: [...new Set([scope.product, ...literals, unresolved])],
    environment: [...new Set([scope.environment, ...literals, unresolved])],
    timeQualifier: [...new Set(time)],
  };
}
export function equivalenceCatalogue(questions: CanonicalQuestion[], scope: string) {
  return questions.map(question => ({
    ref: opaqueReference({
      scope,
      questionId: question.id,
      text: question.originalText,
      instructions: question.instructions,
    }),
    questionId: question.id,
    text: question.originalText,
    instructions: question.instructions ?? '',
  }));
}
export function wireInterpretationSchema(
  catalogue: SourceSpan[],
  choices: ReturnType<typeof interpretationChoices>,
  equivalences: ReturnType<typeof equivalenceCatalogue>,
) {
  const values = (items: string[]) => z.enum(items as [string, ...string[]]);
  return z
    .object({
      domain: values(choices.domain),
      product: values(choices.product),
      environment: values(choices.environment),
      timeQualifier: values(choices.timeQualifier),
      query: values(catalogue.map(span => span.ref)),
      equivalenceKey: values(['none', ...equivalences.map(item => item.ref)]),
      requests: z.object(Object.fromEntries(catalogue.map(span => [span.ref, z.enum([span.field])]))).strict(),
    })
    .strict();
}
export function deriveInterpretation(
  catalogue: SourceSpan[],
  raw: z.infer<ReturnType<typeof wireInterpretationSchema>>,
  equivalences: ReturnType<typeof equivalenceCatalogue>,
): Interpretation {
  const query = catalogue.find(span => span.ref === raw.query)!;
  const representative = equivalences.find(item => item.ref === raw.equivalenceKey);
  const { requests: _requests, ...fields } = raw;
  return interpretationSchema.parse({
    ...fields,
    query: query.text,
    equivalenceKey: representative
      ? `equivalent-${opaqueReference({ text: representative.text, instructions: representative.instructions })}`
      : '',
    subparts: [...new Set(catalogue.map(span => span.text))],
  });
}
