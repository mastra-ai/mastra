import { githubPullRequestLinkKey } from '../integrations/github/rules.js';
import type { BoardsStorage } from '../storage/domains/boards/base.js';
import type { ProjectBoardConfigInput } from '../storage/domains/boards/validation.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import { externalSourceKey } from '../storage/domains/work-items/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { LEGACY_REVIEW_BOARD } from './semantics.js';

export type BoardsMigrationMode = 'apply' | 'dry-run' | 'off';

export interface BoardsMigrationReport {
  mode: Exclude<BoardsMigrationMode, 'off'>;
  projects: number;
  boardsSeeded: number;
  linksBackfilled: number;
  pullRequestLinksMoved: number;
  cardsMoved: number;
  labelRoutesRetargeted: number;
  bindingsRetargeted: number;
  skipped: { id: string; reason: string }[];
}

export function boardsMigrationMode(value = process.env.MASTRA_FACTORY_BOARDS_MIGRATION): BoardsMigrationMode {
  return value === 'dry-run' || value === 'off' ? value : 'apply';
}

const MIGRATION_USER = 'factory-boards-migration';

function sourceKind(item: WorkItemRow): 'issue' | 'pull_request' | null {
  const type = item.externalSource?.type;
  return type === 'pull-request' ? 'pull_request' : type === 'issue' ? 'issue' : null;
}

/**
 * Moves a deployment from the Review board to one stored Work board. Every step is idempotent:
 * a second run finds nothing to do. Per project:
 * 1. seed the stored Work board and default routes when the project has none;
 * 2. link every card to its own issue or pull request; a GitHub pull request Factory opened is also
 *    linked to the card that authored it, under the key provenance uses (its own card stays as that
 *    card's child, hosting the review);
 * 3. move cards still on the retired Review board (and legacy board-less pull request cards) to
 *    Work — phase keys are shared, so stages are kept;
 * 4. retarget label routes and source bindings that named the Review board to Work.
 * `dry-run` reports what would change and writes nothing.
 */
export async function migrateBoards(input: {
  mode: Exclude<BoardsMigrationMode, 'off'>;
  projects: readonly FactoryProject[];
  boards: BoardsStorage;
  workItems: WorkItemsStorage;
  intake?: IntakeStorage;
  /** The boards a project with none stored is seeded with; unset seeds nothing. */
  seedConfig?: ProjectBoardConfigInput;
  /** False when this Factory installs no Work board: Review cards and routes then stay where they are. */
  moveToWork?: boolean;
}): Promise<BoardsMigrationReport> {
  const apply = input.mode === 'apply';
  const moveToWork = input.moveToWork !== false;
  const report: BoardsMigrationReport = {
    mode: input.mode,
    projects: input.projects.length,
    boardsSeeded: 0,
    linksBackfilled: 0,
    pullRequestLinksMoved: 0,
    cardsMoved: 0,
    labelRoutesRetargeted: 0,
    bindingsRetargeted: 0,
    skipped: [],
  };
  const orgs = new Set<string>();

  for (const project of input.projects) {
    const scope = { orgId: project.orgId, factoryProjectId: project.id };
    orgs.add(project.orgId);

    // One bad project or card must not stop the rest: record it and carry on; the next start retries it.
    try {
      if (input.seedConfig && (await input.boards.getRevision(scope)) === 0) {
        if (
          !apply ||
          (await input.boards.seedDefaults({ ...scope, userId: project.createdBy, config: input.seedConfig }))
        )
          report.boardsSeeded++;
      }
    } catch (error) {
      report.skipped.push({ id: project.id, reason: `board not seeded: ${errorText(error)}` });
    }

    let items: WorkItemRow[];
    try {
      items = await input.workItems.list(scope);
    } catch (error) {
      report.skipped.push({ id: project.id, reason: `cards not read: ${errorText(error)}` });
      continue;
    }
    const byId = new Map(items.map(item => [item.id, item]));
    async function migrateItem(item: WorkItemRow): Promise<void> {
      const kind = sourceKind(item);
      const sourceKey = externalSourceKey(item.externalSource);
      if (kind && sourceKey && item.externalSource) {
        const state = item.metadata?.merged === true ? 'merged' : item.metadata?.state === 'closed' ? 'closed' : 'open';
        const headSha =
          typeof item.metadata?.pullRequestHeadSha === 'string' ? { headSha: item.metadata.pullRequestHeadSha } : {};
        // Only a link that has no verdict yet takes the card's recorded one.
        const copyVerdict = async (key: string, link: { reviewVerdict: string | null } | null) => {
          if (!apply || (link?.reviewVerdict ?? null) !== null || typeof item.metadata?.reviewVerdict !== 'string')
            return;
          await input.workItems.recordSourceReview({
            ...scope,
            sourceKey: key,
            verdict: item.metadata.reviewVerdict,
            reviewedHeadSha: typeof item.metadata.reviewedHeadSha === 'string' ? item.metadata.reviewedHeadSha : null,
            reviewedAt: validDate(item.metadata.reviewedAt) ?? new Date(item.updatedAt),
          });
        };

        const existing = await input.workItems.findBySourceKey({ ...scope, sourceKey });
        if (!existing) {
          report.linksBackfilled++;
          if (apply) {
            await input.workItems.linkSource({
              ...scope,
              workItemId: item.id,
              sourceKey,
              kind,
              integration: item.externalSource.integrationId,
              external: {
                externalId: item.externalSource.externalId,
                ...(item.externalSource.url ? { url: item.externalSource.url } : {}),
              },
              state,
              ...headSha,
            });
          }
        }
        await copyVerdict(sourceKey, existing);

        // A pull request Factory opened also belongs to the card that authored it, under the key
        // Factory links its pull requests with — so merge and close handling recognise it there.
        const parent = item.parentWorkItemId ? byId.get(item.parentWorkItemId) : undefined;
        const authoringKey =
          kind === 'pull_request' &&
          item.metadata?.factoryAuthored === true &&
          parent &&
          sourceKind(parent) !== 'pull_request'
            ? factoryPullRequestKey(item)
            : null;
        if (parent && authoringKey) {
          const held = await input.workItems.findBySourceKey({ ...scope, sourceKey: authoringKey });
          if (held?.workItemId !== parent.id) {
            report.pullRequestLinksMoved++;
            if (apply) {
              await input.workItems.linkSource({
                ...scope,
                workItemId: parent.id,
                sourceKey: authoringKey,
                kind,
                integration: 'github',
                external: {
                  repositoryId: item.metadata?.githubRepositoryId,
                  number: item.metadata?.githubPullRequestNumber,
                  ...(item.externalSource.url ? { url: item.externalSource.url } : {}),
                },
                state,
                ...headSha,
                factoryAuthored: true,
                reassign: true,
              });
            }
          }
          await copyVerdict(authoringKey, held?.workItemId === parent.id ? held : null);
        }
      }

      const onReview = item.board === LEGACY_REVIEW_BOARD || (item.board === null && kind === 'pull_request');
      if (!onReview || !moveToWork) return;
      report.cardsMoved++;
      if (!apply) return;
      const moved = await input.workItems.update({
        orgId: item.orgId,
        id: item.id,
        userId: MIGRATION_USER,
        patch: { board: 'work' },
        expectedBoard: item.board,
      });
      if (!moved) report.skipped.push({ id: item.id, reason: 'changed during migration; moved next run' });
    }

    for (const item of items) {
      try {
        await migrateItem(item);
      } catch (error) {
        report.skipped.push({ id: item.id, reason: errorText(error) });
      }
    }
  }

  if (input.intake && moveToWork) {
    for (const orgId of orgs) {
      for (const route of await input.intake.listLabelRoutes({ orgId })) {
        if (route.board !== LEGACY_REVIEW_BOARD) continue;
        report.labelRoutesRetargeted++;
        if (apply) await input.intake.setLabelRoute({ orgId, ...route, board: 'work', userId: MIGRATION_USER });
      }
      for (const binding of await input.intake.listBindings({ orgId })) {
        if (binding.board !== LEGACY_REVIEW_BOARD) continue;
        report.bindingsRetargeted++;
        if (apply) await input.intake.setBinding({ orgId, ...binding, board: 'work', userId: MIGRATION_USER });
      }
    }
  }
  return report;
}

/** The link key Factory records a pull request it opened under; null when the card lacks the GitHub ids. */
function factoryPullRequestKey(item: WorkItemRow): string | null {
  const repositoryId = item.metadata?.githubRepositoryId;
  const number = item.metadata?.githubPullRequestNumber;
  if (item.externalSource?.integrationId !== 'github') return null;
  return typeof repositoryId === 'number' && typeof number === 'number'
    ? githubPullRequestLinkKey(repositoryId, number)
    : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
