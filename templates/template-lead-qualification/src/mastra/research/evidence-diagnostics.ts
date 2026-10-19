import { createHash } from 'node:crypto';
import type { Candidate, Evidence } from './contracts';

export const diagnosticTextLimit = 128;
const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex');
const whitespace = (value: string) => value.replace(/\s+/gu, ' ').trim();
const unicode = (value: string) => whitespace(value.normalize('NFKC'));
const typography = (value: string) =>
  unicode(value)
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[‐‑‒–—−]/gu, '-');
const words = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) ?? [];

/** Conservative omission, not a claim that public pages or model text are trusted. */
export function safeDiagnosticText(value: string) {
  return !/[\p{C}?%#@=]|\b[a-z][a-z\d+.-]*:\/\/|\b(?:authorization|proxy-authorization|bearer|password|passwd|secret|token|(?:access|refresh|auth)[_-]?token|api[_ -]?key|cookie|credential)\b|\bsk-[\w-]+|\beyJ[\w-]+\.[\w-]+\.[\w-]+|[\w+/=-]{24,}/iu.test(
    value,
  );
}

export function rejectedEvidenceDiagnostic(
  candidate: Candidate,
  passages: Array<{ evidenceId: string; quote: string }>,
  material: Evidence[],
  aliases: Map<string, string>,
) {
  const byId = new Map(material.map(source => [source.id, source]));
  const sources = passages.map(passage => byId.get(passage.evidenceId));
  // Unknown and private references retain only the existing rejection/check fields.
  if (sources.some(source => source?.kind !== 'website')) return undefined;
  const privateSources = material.filter(source => source.kind !== 'website');
  const privateWords = new Set(privateSources.flatMap(source => words(source.excerpt)));
  const privateTexts = privateSources.map(source => unicode(source.excerpt).toLowerCase());
  function describe(value: string, publicSources: Evidence[]) {
    const literal = publicSources.some(source => source.excerpt.includes(value));
    const omission = !literal
      ? ('not_public_literal' as const)
      : words(value).some(word => privateWords.has(word)) ||
          privateTexts.some(
            text => text.includes(unicode(value).toLowerCase()) || unicode(value).toLowerCase().includes(text),
          )
        ? ('private_overlap' as const)
        : !safeDiagnosticText(value)
          ? ('sensitive_content' as const)
          : null;
    return {
      digest: fingerprint(value),
      length: value.length,
      publicText: omission === null ? value.slice(0, diagnosticTextLimit).replace(/[\uD800-\uDBFF]$/u, '') : null,
      omission,
    };
  }
  return {
    version: 1 as const,
    verificationContract: 'supported_candidate_ids' as const,
    passages: passages.map((passage, index) => {
      const source = sources[index]!;
      return {
        evidenceId: aliases.get(source.id) ?? source.id,
        evidenceDigest: source.digest,
        sourceDigest: fingerprint(source.source),
        evidenceLength: source.excerpt.length,
        quote: describe(passage.quote, [source]),
        exactQuotePresent: source.excerpt.includes(passage.quote),
        whitespaceNormalizedMatch: whitespace(source.excerpt).includes(whitespace(passage.quote)),
        unicodeNormalizedMatch: unicode(source.excerpt).includes(unicode(passage.quote)),
        typographyNormalizedMatch: typography(source.excerpt).includes(typography(passage.quote)),
      };
    }),
    rationale: candidate.inference ? describe(candidate.inference.rationale, sources as Evidence[]) : null,
  };
}
