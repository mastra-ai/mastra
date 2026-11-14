import { z } from 'zod';
import { idSchema, pathSchema } from '../core/contracts.js';
import { ownerOnlyReadRule, type RouteAccessRule } from '../core/route-access.js';
import type { Evidence } from '../discovery/contracts.js';

export const bolaSelectionSchema = z
  .object({
    checkerId: z.literal('bola_rest_read'),
    candidateId: idSchema,
    evidenceIds: z.array(idSchema).min(2).max(4),
    rationaleCode: z.enum(['OBSERVED_OWNER_DETAIL', 'OBSERVED_DETAIL_RECEIPT']),
    hypothesis: z.literal('alternate_account_reads_owner_object'),
    confidence: z.enum(['low', 'medium', 'high']),
    limitations: z
      .array(z.enum(['single_object', 'two_accounts', 'bounded_get_only']))
      .min(1)
      .max(3),
  })
  .strict();
export type BolaSelection = z.infer<typeof bolaSelectionSchema>;

export type BolaCandidate = {
  id: string;
  routeTemplate: string;
  path: string;
  origin: string;
  ownerProfileId: string;
  alternateProfileId: string;
  collectionPath: string;
  prerequisite: 'collection_detail' | 'detail_receipt';
  expectedUnauthorizedStatus: number[];
  evidenceIds: string[];
};

/** The model sees only candidate IDs, route templates and evidence IDs; opaque object paths stay trusted. */
export function observedBolaCandidates(
  evidence: Evidence[],
  rules: RouteAccessRule[],
  profileIds: [string, string],
): BolaCandidate[] {
  const ownerRules = rules.filter(ownerOnlyReadRule);
  const observed = evidence.filter(item => {
    const value = item.observation;
    return (
      value.source === 'rest-json' &&
      value.provenance === 'upstream-response' &&
      value.kind === 'endpoint' &&
      value.method === 'GET' &&
      value.status === 200 &&
      profileIds.includes(value.profileId) &&
      pathSchema.safeParse(value.path).success
    );
  });
  const ruleFor = (item: Evidence) => ownerRules.find(rule => rule.pathTemplate === item.observation.routeTemplate);
  const collections = observed.filter(
    item => !item.observation.linkedFrom && ruleFor(item) && !item.observation.routeTemplate?.includes('{'),
  );
  const candidates: BolaCandidate[] = [];
  for (const ownerId of profileIds) {
    const alternateId = profileIds.find(id => id !== ownerId)!;
    for (const item of observed) {
      const value = item.observation;
      const rule = ruleFor(item);
      if (value.profileId !== ownerId || !value.linkedFrom || !rule || !rule.pathTemplate.includes('{')) continue;
      const collection = collections.find(
        source =>
          source.observation.profileId === ownerId &&
          source.observation.path === value.linkedFrom &&
          source.observation.origin === value.origin,
      );
      const parentDetail = observed.find(
        source =>
          source.observation.profileId === ownerId &&
          source.observation.path === value.linkedFrom &&
          source.observation.origin === value.origin &&
          source.observation.linkedFrom &&
          ruleFor(source),
      );
      if (!collection && !parentDetail) continue;
      const root =
        collection ??
        collections.find(
          source =>
            source.observation.profileId === ownerId &&
            source.observation.path === parentDetail?.observation.linkedFrom &&
            source.observation.origin === value.origin,
        );
      if (!root) continue;
      const alternateCollection = collections.find(
        source =>
          source.observation.profileId === alternateId &&
          source.observation.path === root.observation.path &&
          source.observation.origin === value.origin,
      );
      if (!alternateCollection) continue;
      const ownEvidence = [root.id, ...(parentDetail ? [parentDetail.id] : []), item.id, alternateCollection.id];
      candidates.push({
        id: item.id,
        routeTemplate: rule.pathTemplate,
        path: value.path,
        origin: value.origin,
        ownerProfileId: ownerId,
        alternateProfileId: alternateId,
        collectionPath: root.observation.path,
        prerequisite: parentDetail ? 'detail_receipt' : 'collection_detail',
        expectedUnauthorizedStatus: rule.expectedUnauthorizedStatus,
        evidenceIds: ownEvidence,
      });
    }
  }
  return candidates.slice(0, 16);
}

/** Resolve an observed collection/detail candidate or reject an unsupported explicit selection. */
export function selectedBolaCandidate(selection: unknown, candidates: BolaCandidate[]): BolaCandidate {
  const value = bolaSelectionSchema.parse(selection);
  const candidate = candidates.find(item => item.id === value.candidateId);
  if (
    !candidate ||
    value.rationaleCode !==
      (candidate.prerequisite === 'collection_detail' ? 'OBSERVED_OWNER_DETAIL' : 'OBSERVED_DETAIL_RECEIPT') ||
    value.evidenceIds.length !== candidate.evidenceIds.length ||
    value.evidenceIds.some((id, index) => id !== candidate.evidenceIds[index])
  )
    throw new Error('BOLA_SELECTION_NOT_GROUNDED');
  return candidate;
}
