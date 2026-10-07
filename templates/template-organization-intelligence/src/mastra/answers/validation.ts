import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { OrganizationAnswer, ProcessorState } from './schema.js';
import { MAX_OUTPUT_CHARACTERS } from './schema.js';

const outputDraftSchema = z.object({
  status: z.enum(['answered', 'insufficient_evidence', 'conflicting_evidence']),
  answer: z.string().trim().min(1).max(MAX_OUTPUT_CHARACTERS),
  citations: z.array(z.object({ recordId: z.string().min(1), locator: z.string().min(1) })).max(6),
});

export function safeOperationalResult(state: ProcessorState): OrganizationAnswer {
  return {
    status: 'operational_error',
    answer: 'The answer could not be validated. Please retry.',
    citations: [],
    sourceStatus: state.sourceStatus ?? [],
    metadata: {
      correlationId: state.correlationId ?? randomUUID(),
      retrievalMs: state.retrievalMs ?? 0,
      sourceIds: [...new Set((state.evidence ?? []).map(evidence => evidence.sourceId))],
      ...(state.validationFailure ? { validationFailure: state.validationFailure } : {}),
    },
  };
}

export function validatedResult(state: ProcessorState, finishReason: unknown): OrganizationAnswer {
  if (finishReason === 'length') {
    state.validationFailure = 'output_limit';
    return safeOperationalResult(state);
  }
  if (state.operationalFailure) {
    state.validationFailure = 'retrieval_failure';
    return safeOperationalResult(state);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(state.rawText ?? '');
  } catch {
    state.validationFailure = 'invalid_json';
    throw new Error('Generated answer was not JSON.');
  }
  const draftResult = outputDraftSchema.safeParse(parsed);
  if (!draftResult.success) {
    state.validationFailure = 'invalid_status_or_draft';
    throw new Error('Generated answer did not match the draft contract.');
  }
  const draft = draftResult.data;
  const evidence = new Map((state.evidence ?? []).map(item => [item.recordId + '\u0000' + item.locator, item]));
  const citations = draft.citations.map(citation => {
    const trusted = evidence.get(citation.recordId + '\u0000' + citation.locator);
    if (!trusted) {
      state.validationFailure = 'invalid_citation';
      throw new Error('Generated answer cited evidence that was not retrieved.');
    }
    const { excerpt: _excerpt, ...citationResult } = trusted;
    return citationResult;
  });
  if (draft.status === 'answered' && !citations.length) {
    state.validationFailure = 'missing_citation';
    throw new Error('Grounded answers require a retrieved citation.');
  }
  if (draft.status === 'insufficient_evidence' && citations.length) {
    state.validationFailure = 'invalid_abstention';
    throw new Error('Insufficient-evidence answers must not cite unsupported records.');
  }
  if (draft.status === 'conflicting_evidence' && new Set(citations.map(citation => citation.recordId)).size < 2) {
    state.validationFailure = 'incomplete_conflict';
    throw new Error('Conflicting-evidence answers must cite both alternatives.');
  }
  return {
    ...draft,
    citations,
    sourceStatus: state.sourceStatus ?? [],
    metadata: {
      correlationId: state.correlationId ?? randomUUID(),
      retrievalMs: state.retrievalMs ?? 0,
      sourceIds: [...new Set((state.evidence ?? []).map(item => item.sourceId))],
    },
  };
}
