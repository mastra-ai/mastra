import { isDeepStrictEqual } from 'node:util';
import type { ReviewGroup } from '../../capabilities/review-group.js';
import type { ExternalRepositoryProjectTarget } from '../../storage/domains/source-control/base.js';
import { WorkItemUpdateConflictError } from '../../storage/domains/work-items/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { ReconcilePullRequestState } from './rules.js';
import { canonicalSourceKey, cardBelongsToRepository, legacySourceKey } from './work-item-source.js';

const MAX_GROUP_UPDATE_ATTEMPTS = 3;

export async function findGithubPullRequestCard(
  storage: WorkItemsStorage,
  project: Pick<ExternalRepositoryProjectTarget, 'orgId' | 'factoryProjectId'>,
  repositoryId: number,
  repositoryName: string,
  pullRequestNumber: number,
): Promise<WorkItemRow | undefined> {
  const legacyId = legacySourceKey(repositoryId, 'pull-request', pullRequestNumber);
  for (const externalId of [canonicalSourceKey('pull-request', pullRequestNumber), legacyId]) {
    const card = await storage.getByProjectSource({
      orgId: project.orgId,
      factoryProjectId: project.factoryProjectId,
      source: { integrationId: 'github', type: 'pull-request', externalId },
    });
    if (!card) continue;
    const matchesRepository = externalId === legacyId || cardBelongsToRepository(card, repositoryId, repositoryName);
    if (matchesRepository) return card;
  }
  return undefined;
}

export async function syncGithubReviewGroup({
  storage,
  card,
  hint,
  initialState,
  fetchState,
}: {
  storage: WorkItemsStorage;
  card: WorkItemRow;
  hint?: ReviewGroup | null;
  initialState?: ReconcilePullRequestState;
  fetchState: () => Promise<ReconcilePullRequestState | undefined>;
}): Promise<{ status: 'ignored' | 'committed' }> {
  if (hint !== undefined && isDeepStrictEqual(card.metadata?.reviewGroup ?? null, hint)) return { status: 'ignored' };
  for (let attempt = 0; attempt < MAX_GROUP_UPDATE_ATTEMPTS; attempt += 1) {
    const state = initialState ?? (await fetchState());
    initialState = undefined;
    if (state?.reviewGroup === undefined) return { status: 'ignored' };
    const reviewGroup = state.reviewGroup;
    if (isDeepStrictEqual(card.metadata?.reviewGroup ?? null, reviewGroup)) return { status: 'ignored' };
    try {
      const updated = await storage.update({
        orgId: card.orgId,
        id: card.id,
        userId: 'factory-rule-dispatcher',
        patch: { metadata: { reviewGroup } },
        expectedRevision: card.revision,
      });
      return { status: updated ? 'committed' : 'ignored' };
    } catch (error) {
      if (!(error instanceof WorkItemUpdateConflictError) || attempt === MAX_GROUP_UPDATE_ATTEMPTS - 1) throw error;
      const currentCard = await storage.get({ orgId: card.orgId, id: card.id });
      if (!currentCard) return { status: 'ignored' };
      card = currentCard;
    }
  }
  throw new Error('GitHub review group synchronization exhausted its attempts');
}
