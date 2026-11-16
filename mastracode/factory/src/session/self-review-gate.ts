import type { RequestContext } from '@mastra/core/request-context';

import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import { cardBoardFlow, isPullRequestCard } from '../boards/semantics.js';
import { resolveFactorySessionAddress } from '../rules/binding-context.js';
import { workItemSource } from '../rules/types.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { REPOSITORY_CHOICE_KEY, resolveWorkItemRepository } from './work-item-repository.js';

/** The repository a source-control tool call targets. */
export interface ChangeTarget {
  slug: string;
  /** True when the target is the repository the session is filed under. */
  ownRepository: boolean;
}

async function boundCard(requestContext: RequestContext | undefined, workItems: WorkItemsStorage) {
  const resolution = await resolveFactorySessionAddress({ requestContext, storage: workItems });
  if (!resolution) return undefined;
  const binding = resolution.binding ?? (await workItems.findActiveRunBinding(resolution.address));
  if (!binding) return undefined;
  const item = await workItems.get({ orgId: binding.orgId, id: binding.workItemId });
  return item ? { binding, item } : undefined;
}

/**
 * The head self-review approved for the session's card, which a change request must open at.
 * `undefined` leaves the change request ungated (the card's board has no self-review phase, or
 * the change request is in a repository other than the card's); `null` blocks it until
 * self-review approves.
 */
export async function selfReviewApprovedHead(options: {
  requestContext: RequestContext | undefined;
  workItems: WorkItemsStorage;
  boards: BoardRegistry | ProjectBoardSource;
  target: ChangeTarget;
}): Promise<string | null | undefined> {
  const bound = await boundCard(options.requestContext, options.workItems);
  if (!bound) return undefined;
  const { binding, item } = bound;
  // Self-review covers the card's repository: the one it names, else the session's own.
  const cardRepository = typeof item.metadata?.repository === 'string' ? item.metadata.repository : undefined;
  if (cardRepository !== undefined ? cardRepository !== options.target.slug : !options.target.ownRepository) {
    return undefined;
  }
  const boards = await toBoardSource(options.boards).load(binding);
  if (cardBoardFlow(boards, item).selfReview === undefined) return undefined;
  // A pull request's own card is reviewed, never self-reviewed.
  if (isPullRequestCard({ source: workItemSource(item.externalSource) })) return undefined;
  if (typeof item.metadata?.openPullRequestNumber === 'number') return undefined;
  const sha = item.metadata?.selfReviewedHeadSha;
  return item.metadata?.selfReviewVerdict === 'approve' && typeof sha === 'string' ? sha : null;
}

/**
 * Record the repository a run pushed to, or opened a change request in, as its
 * card's repository when the card names none. Its later runs (the review seat,
 * a retry) then start there, and this session may keep working on the card
 * from the repository it is filed under. A card that already resolves to a
 * repository keeps it.
 */
export async function recordRunRepositoryChoice(options: {
  requestContext: RequestContext | undefined;
  workItems: WorkItemsStorage;
  intake?: Pick<IntakeStorage, 'getConfig'>;
  sourceControl: SourceControlStorageHandle;
  target: ChangeTarget;
}): Promise<void> {
  const bound = await boundCard(options.requestContext, options.workItems);
  if (!bound) return;
  const { binding, item } = bound;
  const intakeConfig = await options.intake?.getConfig({ orgId: binding.orgId, integrationIds: ['linear'] });
  const resolution = await resolveWorkItemRepository({
    sourceControl: options.sourceControl,
    orgId: binding.orgId,
    factoryProjectId: binding.factoryProjectId,
    item,
    linearRepositoryMap: intakeConfig?.linear?.repositoryByLinearProject,
  });
  if (resolution.status !== 'ambiguous') return;
  try {
    await options.workItems.update({
      orgId: binding.orgId,
      id: item.id,
      userId: `agent:${binding.id}`,
      expectedRevision: item.revision,
      patch: {
        metadata: {
          repository: options.target.slug,
          [REPOSITORY_CHOICE_KEY]: { slug: options.target.slug, sessionId: binding.sessionId },
        },
      },
    });
  } catch (error) {
    // The card moved under the write; the next push records it.
    if (!(error instanceof WorkItemUpdateConflictError)) throw error;
  }
}
