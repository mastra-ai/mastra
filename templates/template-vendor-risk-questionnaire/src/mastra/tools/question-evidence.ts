import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { EvidenceExcerpt } from '../evidence/snapshot.ts';
import { canonicalJson } from '../intake/source.ts';
import { ProcessingFailure } from '../processing/failure.ts';
import type { createScreening } from '../processing/security.ts';
import type { EvidenceAccess } from './snapshot-evidence.ts';

export function modelEvidenceExcerpt(excerpt: EvidenceExcerpt) {
  return {
    id: excerpt.id,
    documentId: excerpt.documentId,
    version: excerpt.version,
    citationLabel: excerpt.citationLabel,
    kind: excerpt.kind,
    disclosure: excerpt.disclosure,
    text: excerpt.text,
  };
}

export function createQuestionEvidenceTools(options: {
  evidence: EvidenceAccess;
  delivered: Map<string, EvidenceExcerpt>;
  screen: ReturnType<typeof createScreening>;
}) {
  const { evidence, delivered, screen } = options;

  async function acceptEvidence<Payload>(excerpts: EvidenceExcerpt[], payload: Payload): Promise<Payload> {
    for (const excerpt of excerpts) await screen(canonicalJson(modelEvidenceExcerpt(excerpt)), 'evidence');
    await screen(canonicalJson(payload), 'tool_result');

    for (const excerpt of excerpts) delivered.set(excerpt.id, excerpt);
    return payload;
  }

  return {
    evidence_search: createTool({
      id: 'evidence_search',
      description: 'Search this run’s approved read-only evidence. Retrieval scores are not confidence.',
      inputSchema: z
        .object({ query: z.string().min(1).max(1000), topK: z.int().positive().max(3).default(2) })
        .strict(),
      execute: async input => {
        await screen(canonicalJson(input), 'tool_result');
        const hits = await evidence.search(input.query, input.topK);
        const payload = hits.map(hit => ({ excerpt: modelEvidenceExcerpt(hit.excerpt) }));

        return acceptEvidence(
          hits.map(hit => hit.excerpt),
          payload,
        );
      },
    }),
    evidence_read: createTool({
      id: 'evidence_read',
      description: 'Read only an excerpt ID already returned to this question. No paths or URLs.',
      inputSchema: z.object({ id: z.string().min(1).max(240) }).strict(),
      execute: async input => {
        await screen(canonicalJson(input), 'tool_result');
        if (!delivered.has(input.id)) throw new ProcessingFailure('INVALID_ATTRIBUTION');

        const excerpt = await evidence.read(input.id);
        return acceptEvidence([excerpt], modelEvidenceExcerpt(excerpt));
      },
    }),
  };
}
