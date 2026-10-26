import { randomUUID } from 'node:crypto';
import type { SavedSource } from './case-contracts.js';
import { canonicalJson } from './case-contracts.js';
import { EvidenceValidationError, type GroundingPath } from './operation-errors.js';
import type {
  Analysis,
  AnalysisInput,
  Comparison,
  Evidence,
  Extraction,
  SemanticAssessment,
  Term,
  TermValue,
} from './reconciliation-contracts.js';

import { compareDecimals, normalizeDecimal } from './decimal-utils.js';
import { normalizeText, sameTerm } from './term-utils.js';

/** Compare typed insurance values after normalizing formatting while retaining comparison dimensions. */
export function equalValues(left: TermValue, right: TermValue): boolean {
  const normalized = (value: TermValue): unknown => {
    switch (value.type) {
      case 'money':
        return {
          ...value,
          amount: normalizeDecimal(value.amount),
          minimum: value.minimum === null ? null : normalizeDecimal(value.minimum),
          maximum: value.maximum === null ? null : normalizeDecimal(value.maximum),
          unit: normalizeText(value.unit),
          basis: normalizeText(value.basis),
        };
      case 'number':
        return {
          ...value,
          amount: normalizeDecimal(value.amount),
          unit: normalizeText(value.unit),
          basis: normalizeText(value.basis),
        };
      case 'entity':
        return {
          ...value,
          name: normalizeText(value.name),
          address: value.address === null ? null : normalizeText(value.address),
          unit: value.unit === null ? null : normalizeText(value.unit),
        };
      case 'text':
        return { ...value, value: normalizeText(value.value) };
      case 'clause':
        return { ...value, wording: normalizeText(value.wording), heading: normalizeText(value.heading) };
      case 'date':
        return value;
    }
  };
  return canonicalJson(normalized(left)) === canonicalJson(normalized(right));
}
/** Reject evidence whose source identity, locator, or exact excerpt differs from captured content. */
export function verifyEvidence(
  evidence: Evidence,
  sources: SavedSource[],
  path: GroundingPath = [],
  trustedSourceId?: string,
) {
  const source = sources.find(source => source.sourceId === evidence.sourceId);
  const invalid = (
    reason: ConstructorParameters<typeof EvidenceValidationError>[0]['reason'],
    field: GroundingPath[number],
  ) => new EvidenceValidationError({ reason, path: [...path, field] }, trustedSourceId ?? source?.sourceId);
  if (!source) throw invalid('source_id_mismatch', 'sourceId');
  if (source.version !== evidence.version) throw invalid('source_version_mismatch', 'version');
  if (source.hash !== evidence.hash) throw invalid('source_hash_mismatch', 'hash');
  if (source.kind === 'pdf') {
    const page = source.pages.find(page => page.physicalPage === evidence.physicalPage);
    if (!page) throw invalid('physical_page_missing', 'physicalPage');
    if (!page.text.includes(evidence.excerpt)) throw invalid('excerpt_not_exact', 'excerpt');
  } else {
    const captured = source.evidence.find(item => item.recordId === evidence.recordId && item.field === evidence.field);
    if (!captured) throw invalid('record_locator_missing', 'recordId');
    if (
      !(typeof captured.value === 'string' ? captured.value : canonicalJson(captured.value)).includes(evidence.excerpt)
    )
      throw invalid('excerpt_not_exact', 'excerpt');
  }
}
/** Find the first typed value component unsupported by the quoted source wording. */
function unsupportedValueField(value: TermValue, original: string): GroundingPath[number] | undefined {
  const contains = (text: string) => normalizeText(original).includes(normalizeText(text));
  const numbers = original.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/g) ?? [];
  const hasNumber = (amount: string) => numbers.some(number => normalizeDecimal(number) === normalizeDecimal(amount));
  const basisSupported = (basis: string) =>
    basis === 'fixed'
      ? !/%|\bpercent(?:age)?\b/i.test(original)
      : basis === 'percentage'
        ? /%|\bpercent(?:age)?\b/i.test(original)
        : contains(basis);
  switch (value.type) {
    case 'money':
      if (!hasNumber(value.amount)) return 'amount';
      if (!contains(value.currency)) return 'currency';
      if (!contains(value.unit)) return 'unit';
      if (!basisSupported(value.basis)) return 'basis';
      if (value.minimum !== null && !hasNumber(value.minimum)) return 'minimum';
      if (value.maximum !== null && !hasNumber(value.maximum)) return 'maximum';
      return;
    case 'number':
      if (!hasNumber(value.amount)) return 'amount';
      if (!contains(value.unit)) return 'unit';
      if (!basisSupported(value.basis)) return 'basis';
      return;
    case 'date':
      return contains(value.value) ? undefined : 'value';
    case 'entity':
      if (!contains(value.name)) return 'name';
      if (value.address !== null && !contains(value.address)) return 'address';
      if (value.unit !== null && !contains(value.unit)) return 'unit';
      return;
    case 'text':
      return contains(value.value) ? undefined : 'value';
    case 'clause':
      if (!contains(value.wording)) return 'wording';
      if (!contains(value.heading)) return 'heading';
      if (value.clauseId !== null && !contains(value.clauseId)) return 'clauseId';
      return;
  }
}
/** Check that the quoted wording supports every component of a typed insurance value. */
export function valueSupported(value: TermValue, original: string): boolean {
  return unsupportedValueField(value, original) === undefined;
}
/** Verify source ownership, typed values, evidence excerpts, and reviewed locators before comparison. */
export function verifyExtraction(extraction: Extraction, source: SavedSource) {
  const invalid = (reason: ConstructorParameters<typeof EvidenceValidationError>[0]['reason'], path: GroundingPath) =>
    new EvidenceValidationError({ reason, path }, source.sourceId);
  if (extraction.sourceId !== source.sourceId) throw invalid('source_id_mismatch', ['sourceId']);
  const verify = (evidence: Evidence[], path: GroundingPath) => {
    for (const [index, item] of evidence.entries()) {
      const location: GroundingPath = [...path, 'evidence', index];
      if (item.sourceId !== source.sourceId) throw invalid('source_id_mismatch', [...location, 'sourceId']);
      verifyEvidence(item, [source], location, source.sourceId);
    }
  };
  for (const [index, term] of extraction.terms.entries()) {
    verify(term.evidence, ['terms', index]);
    if (!term.evidence.some(item => item.excerpt.includes(term.original)))
      throw invalid('original_not_in_excerpt', ['terms', index, 'original']);
    const unsupported = unsupportedValueField(term.value, term.original);
    if (unsupported !== undefined) throw invalid('typed_value_unsupported', ['terms', index, 'value', unsupported]);
  }
  for (const [index, change] of extraction.changes.entries()) verify(change.evidence, ['changes', index]);
  if (source.kind === 'pdf') {
    if (extraction.reviewedRecords.length) throw invalid('review_locator_kind_mismatch', ['reviewedRecords']);
    const index = extraction.reviewedPages.findIndex(page => !source.pages.some(saved => saved.physicalPage === page));
    if (index !== -1) throw invalid('reviewed_locator_missing', ['reviewedPages', index]);
  } else {
    if (extraction.reviewedPages.length) throw invalid('review_locator_kind_mismatch', ['reviewedPages']);
    const index = extraction.reviewedRecords.findIndex(
      locator => !source.evidence.some(item => item.recordId === locator.recordId && item.field === locator.field),
    );
    if (index !== -1) throw invalid('reviewed_locator_missing', ['reviewedRecords', index]);
  }
}
/** Require every captured page or record to be reviewed without unresolved scope limitations. */
export function completeScope(extraction: Extraction, source: SavedSource): boolean {
  if (!extraction.complete || extraction.limitations.length || source.limitations.length) return false;
  return source.kind === 'pdf'
    ? source.pages.every(page => !page.limitation && extraction.reviewedPages.includes(page.physicalPage))
    : source.evidence.every(item =>
        extraction.reviewedRecords.some(locator => locator.recordId === item.recordId && locator.field === item.field),
      );
}
/** Retain short source-bound excerpts from reviewed locations as evidence of the comparison scope. */
function searchEvidence(extraction: Extraction, source: SavedSource): Evidence[] {
  const common = {
    sourceId: source.sourceId,
    version: source.version,
    hash: source.hash,
  };
  return source.kind === 'pdf'
    ? source.pages
        .filter(page => extraction.reviewedPages.includes(page.physicalPage) && page.text.trim())
        .map(page => ({
          ...common,
          physicalPage: page.physicalPage,
          recordId: null,
          field: null,
          excerpt: page.text.slice(0, 200),
        }))
    : source.evidence
        .filter(item =>
          extraction.reviewedRecords.some(
            locator => locator.recordId === item.recordId && locator.field === item.field,
          ),
        )
        .map(item => ({
          ...common,
          physicalPage: null,
          recordId: item.recordId,
          field: item.field,
          excerpt: (typeof item.value === 'string' ? item.value : canonicalJson(item.value)).slice(0, 200),
        }));
}
/** Check the complete source for a term label, original wording, or entity name. */
function sourceMentions(term: Term, source: SavedSource): boolean {
  const content = normalizeText(
    source.kind === 'pdf' ? source.pages.map(page => page.text).join('\n') : canonicalJson(source.records),
  );
  const names = term.value.type === 'entity' ? [term.value.name] : [term.label, term.original];
  return names.some(value => content.includes(normalizeText(value)));
}
type AuthorityConcern = { uncertainty: string; evidence: Evidence | null };
/** Scan the entire amendment for revoked, conditional, or otherwise uncertain authority. */
function sourceAuthorityConcerns(source: SavedSource): AuthorityConcern[] {
  // Inspect the whole immutable amendment, including context the model omitted from its positive quotation.
  // An adverse status leaves the applicable authority interval unresolved; dates or upload order cannot restore it.
  const adverse =
    /\b(?:revok(?:e[ds]?|ing)|revocation|rescind(?:ed|s|ing)?|rescission|cancel(?:led|ed|lation|s)?|withdraw(?:n|al|s|ing)?|withdrew|supersed(?:e[ds]?|ing)|expir(?:e[ds]?|ation|y)|terminat(?:e[ds]?|ion)|suspend(?:ed|s|ing)?|suspension|void(?:ed)?|invalid(?:ated)?|pending|conditional|unconfirmed|disputed)\b|\b(?:not|never|no longer)\s+(?:approved|authori[sz]ed|effective|valid|in force)\b|\b(?:approval|authorization|effective (?:date|interval))\s+(?:(?:is|was|remains)\s+)?(?:unknown|unclear)\b|subject to/i;
  const contexts =
    source.kind === 'pdf'
      ? source.pages.map(page => ({
          text: page.text,
          physicalPage: page.physicalPage,
          recordId: null,
          field: null,
          retrievable: true,
        }))
      : Object.entries(source.records).flatMap(([recordId, fields]) =>
          Object.entries(fields).map(([field, value]) => ({
            text: typeof value === 'string' ? value : canonicalJson(value),
            physicalPage: null,
            recordId,
            field,
            retrievable: source.evidence.some(item => item.recordId === recordId && item.field === field),
          })),
        );
  return contexts.flatMap(context => {
    const match = adverse.exec(context.text);
    if (!match) return [];
    const evidence = context.retrievable
      ? {
          sourceId: source.sourceId,
          version: source.version,
          hash: source.hash,
          physicalPage: context.physicalPage,
          recordId: context.recordId,
          field: context.field,
          excerpt: context.text.slice(Math.max(0, match.index - 160), match.index + match[0].length + 240),
        }
      : null;
    if (evidence) verifyEvidence(evidence, [source]);
    return [
      {
        uncertainty: `The amendment source records ${normalizeText(match[0])} authority or an unresolved effective interval. Active authorization requires broker review.`,
        evidence,
      },
    ];
  });
}
/** Explain a lower limit only when currency, basis, and other comparison dimensions agree. */
function limitReductionRationale(term: Term, expected: TermValue | null, actual: Term | null): string | null {
  const observed = actual?.value;
  if (!/(?:^|[\s_.-])(?:sub)?limits?(?:$|[\s_.-])/.test(normalizeText(term.category)) || !expected || !observed)
    return null;
  if (
    (expected.type !== 'money' && expected.type !== 'number') ||
    (observed.type !== 'money' && observed.type !== 'number')
  )
    return null;
  if (
    !equalValues({ ...expected, amount: observed.amount }, observed) ||
    compareDecimals(observed.amount, expected.amount) >= 0
  )
    return null;
  const describe = (value: typeof expected) =>
    value.type === 'money' ? `${value.currency} ${value.amount}` : `${value.amount} ${value.unit}`;
  return `The documented limit decreased from ${describe(expected)} to ${describe(observed)} for ${term.scope} under the same comparison dimensions. This potentially material reduction is a High review priority, not a coverage conclusion.`;
}
/** Explain opposite coverage statements about the same risk in aligned, unambiguous clauses. */
function exclusionChangeRationale(
  expected: TermValue | null,
  actual: Term | null,
  assessment: SemanticAssessment['assessments'][number] | undefined,
): string | null {
  const observed = actual?.value;
  if (
    expected?.type !== 'clause' ||
    observed?.type !== 'clause' ||
    assessment?.conclusion !== 'different' ||
    assessment.uncertainty.length
  )
    return null;
  const aligned =
    expected.clauseId !== null && observed.clauseId !== null
      ? expected.clauseId === observed.clauseId
      : normalizeText(expected.heading) === normalizeText(observed.heading);
  if (!aligned) return null;
  const statements = (wording: string) =>
    [...wording.matchAll(/(?:^|[.:;!?]\s*)([^.:;!?]+?)\s+(?:is|are)\s+(covered|excluded|not covered)\b/gi)].map(
      match => ({
        subject: match[1]!.trim(),
        disposition: normalizeText(match[2]!) === 'covered' ? 'covers' : 'excludes',
      }),
    );
  const referenceStatements = statements(expected.wording),
    targetStatements = statements(observed.wording);
  // A changed word alone does not establish a material exclusion. Require an explicit opposite assertion
  // about the same risk, and leave qualified or conflicting assertions to the structured review assessment.
  if (referenceStatements.length !== 1 || targetStatements.length !== 1) return null;
  const reference = referenceStatements[0]!,
    target = targetStatements[0]!;
  if (
    normalizeText(reference.subject) !== normalizeText(target.subject) ||
    reference.disposition === target.disposition
  )
    return null;
  return `The reference states that it ${reference.disposition} "${reference.subject}"; the target states that it ${target.disposition} the same subject. Read both complete clauses and their qualifications. This potentially material exclusion change has High review priority, not a coverage conclusion.`;
}
/** Require an explicit sourced approval for this policy, term, value, and effective date. */
function authorized(change: Extraction['changes'][number], term: Term, input: AnalysisInput): boolean {
  if (
    input.clarification.intent !== 'agreed_terms_checking' ||
    !input.identity.policyNumber ||
    change.policyNumber !== input.identity.policyNumber ||
    change.effectiveFrom > input.asOf ||
    (change.effectiveTo !== null && change.effectiveTo < input.asOf)
  )
    return false;
  const quote = normalizeText(change.approvalStatement);
  // Every authority component must occur in the verified statement, rather than a title or model assertion.
  return (
    /\b(approved|authorized)\b|\b(hereby|explicitly) (approve|authorize)\b/.test(quote) &&
    !/\b(no|not|never|pending|conditional|draft|requested|rejected|declined|withdrawn|would|may|if|unless|awaiting|proposed)\b|subject to/.test(
      quote,
    ) &&
    [change.policyNumber, change.approver, change.effectiveFrom, term.label, term.scope].every(value =>
      quote.includes(normalizeText(value)),
    ) &&
    change.evidence.some(item => item.excerpt.includes(change.approvalStatement)) &&
    valueSupported(change.value, change.approvalStatement)
  );
}
/** Classify extracted terms using verified evidence, amendment authority, scope completeness, and rules. */
export function reconcile(
  input: AnalysisInput,
  extractions: Extraction[],
  semantic: SemanticAssessment,
  attemptId: string,
): Analysis {
  const reference = extractions.find(value => value.sourceId === input.clarification.referenceId)!;
  const target = extractions.find(value => value.sourceId === input.clarification.targetId)!;
  const source = (id: string) => input.sources.find(source => source.sourceId === id)!;
  const sufficient = extractions.every(extraction => completeScope(extraction, source(extraction.sourceId)));
  const searched = [reference, target].map(value => ({
    sourceId: value.sourceId,
    pages: value.reviewedPages,
    records: value.reviewedRecords,
    complete: completeScope(value, source(value.sourceId)),
  }));
  const comparisons: Comparison[] = [];
  const supporting = extractions.filter(
    extraction => extraction.sourceId !== reference.sourceId && extraction.sourceId !== target.sourceId,
  );
  const sourceConcerns = new Map(
    supporting.map(extraction => [extraction.sourceId, sourceAuthorityConcerns(source(extraction.sourceId))]),
  );
  const terms = [
    ...reference.terms,
    ...target.terms.filter(term => !reference.terms.some(left => sameTerm(left, term))),
  ];
  for (const term of terms) {
    const baseline = reference.terms.find(left => sameTerm(left, term)) ?? null;
    const actual = target.terms.find(right => sameTerm(right, term)) ?? null;
    const changes = supporting.flatMap(extraction =>
      extraction.changes
        .filter(change => sameTerm(change, term))
        .map(change => ({
          change,
          sourceId: extraction.sourceId,
          concerns: sourceConcerns.get(extraction.sourceId)!,
        })),
    );
    const binders = supporting.filter(
      extraction => input.clarification.roles.find(role => role.sourceId === extraction.sourceId)?.role === 'binder',
    );
    const binderConflict = binders.some(extraction =>
      extraction.terms.some(item => sameTerm(item, term) && baseline && !equalValues(item.value, baseline.value)),
    );
    const valid = baseline
      ? changes.filter(
          ({ change, sourceId, concerns }) =>
            input.clarification.roles.find(role => role.sourceId === sourceId)?.role === 'amendment' &&
            concerns.length === 0 &&
            authorized(change, baseline, input),
        )
      : [];
    const distinct = new Set(valid.map(({ change }) => canonicalJson(change.value)));
    const conflict = binderConflict || changes.some(item => !valid.includes(item)) || distinct.size > 1;
    const effective = valid[0]?.change.value ?? baseline?.value ?? null;
    let classification: Comparison['classification'];
    let observation: string;
    let interpretation = '';
    const uncertainty = [
      ...(baseline?.uncertainty ?? []),
      ...(actual?.uncertainty ?? []),
      ...changes.flatMap(item => item.concerns.map(concern => concern.uncertainty)),
    ];
    const assessment = semantic.assessments.find(item => sameTerm(item, term));
    if (conflict || uncertainty.length) {
      classification = 'REQUIRES_REVIEW';
      observation = 'Conflicting or insufficiently authorized source terms require broker review.';
    } else if (!baseline || !actual) {
      const unaligned = sourceMentions(term, source(actual ? reference.sourceId : target.sourceId));
      classification = !sufficient ? 'MISSING_EVIDENCE' : unaligned ? 'REQUIRES_REVIEW' : 'DISCREPANCY';
      observation =
        sufficient && unaligned
          ? 'Matching source text was found but was not aligned as a typed term; absence cannot be established.'
          : sufficient
            ? `The ${actual ? 'reference' : 'target'} term was not found within the recorded reviewed source scope.`
            : 'The reviewed source scope is incomplete; absence cannot be established.';
    } else if (!sufficient) {
      classification = 'REQUIRES_REVIEW';
      observation = 'Verified term excerpts are available, but source scope is incomplete.';
    } else if (effective && equalValues(effective, actual.value)) {
      classification = valid.length && !equalValues(baseline.value, actual.value) ? 'AUTHORIZED_CHANGE' : 'MATCH';
      observation =
        classification === 'MATCH'
          ? 'The typed values and their comparison dimensions match.'
          : 'The issued value matches the documented, scoped authorized change.';
    } else if (baseline.value.type === 'clause' || actual.value.type === 'clause') {
      classification =
        assessment?.conclusion === 'different' && !assessment.uncertainty.length ? 'DISCREPANCY' : 'REQUIRES_REVIEW';
      observation = assessment?.observation ?? 'The clauses could not be aligned with sufficient evidence.';
      interpretation =
        assessment?.interpretation ?? 'Semantic similarity alone does not establish equivalent coverage.';
    } else {
      classification = 'DISCREPANCY';
      observation = 'The typed values differ within their documented currency, unit, basis, date or entity scope.';
    }
    const isDiscrepancy = classification === 'DISCREPANCY';
    const reductionRationale = limitReductionRationale(term, effective, actual);
    const exclusionRationale = exclusionChangeRationale(effective, actual, assessment);
    const highRationale = reductionRationale ?? exclusionRationale;
    comparisons.push({
      id: randomUUID(),
      category: term.category,
      key: term.key,
      label: term.label,
      scope: term.scope,
      baseline,
      actual,
      effectiveValue: effective,
      classification,
      evidence: [
        ...(baseline?.evidence ?? []),
        ...(actual?.evidence ?? []),
        ...changes.flatMap(item => item.change.evidence),
        ...changes.flatMap(item => item.concerns.flatMap(concern => (concern.evidence ? [concern.evidence] : []))),
        ...(!baseline || !actual
          ? [reference, target].flatMap(extraction => searchEvidence(extraction, source(extraction.sourceId)))
          : []),
      ],
      searched,
      observation,
      interpretation,
      uncertainty: [...uncertainty, ...(assessment?.uncertainty ?? [])],
      action:
        input.clarification.intent === 'document_comparison'
          ? 'Review this document observation; contractual acceptance has not been established.'
          : isDiscrepancy
            ? 'Ask the broker to review this observed difference before taking any action.'
            : classification === 'MATCH' || classification === 'AUTHORIZED_CHANGE'
              ? 'Retain the supporting evidence for broker review.'
              : 'Obtain missing evidence or broker clarification.',
      severity: isDiscrepancy
        ? {
            level: highRationale || (!actual && term.value.type === 'entity') ? 'High' : 'Medium',
            rationale:
              highRationale ??
              (!actual && term.value.type === 'entity'
                ? 'A potentially material entity or location is absent from the fully reviewed target scope.'
                : 'A verified difference requires clarification; this is a review priority, not a coverage conclusion.'),
          }
        : null,
      appliedChanges: valid.map(item => item.change),
    });
  }
  const rules = input.profile.rules.flatMap(rule => {
    const found = comparisons.find(item => item.category === rule.category && item.key === rule.key && item.actual);
    return rule.requirement === 'review' || !found
      ? [
          {
            profileId: input.profile.id,
            version: input.profile.version,
            ruleId: rule.id,
            observation: `${rule.description} ${found ? 'Broker review is required by the configured profile.' : 'The configured required term was not established in the target.'} This rule is separate from contractual evidence.`,
          },
        ]
      : [];
  });
  const limitations = [
    ...new Set([
      ...input.sources.flatMap(source => source.limitations),
      ...extractions.flatMap(value => [...value.limitations, ...(value.notes ?? [])]),
      ...(!sufficient ? ['The captured or reviewed scope is incomplete; no overall assurance is available.'] : []),
      ...(input.clarification.intent === 'document_comparison'
        ? ['The selected reference does not establish contractual acceptance. Observations describe documents only.']
        : []),
      'Automated observations do not certify coverage or establish legal precedence.',
    ]),
  ];
  return {
    id: randomUUID(),
    attemptId,
    inputHash: '',
    input: structuredClone(input),
    createdAt: new Date().toISOString(),
    extractions,
    semantic,
    comparisons,
    rules,
    limitations,
    conclusion:
      !sufficient ||
      !comparisons.length ||
      comparisons.some(item => ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(item.classification))
        ? 'INCOMPLETE'
        : 'OBSERVATIONS_AVAILABLE',
  };
}
