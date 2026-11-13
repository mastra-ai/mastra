import type { Intake, IntakeIssue, ResolvedIntakeDispatch } from '../capabilities/intake.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { storageCards } from './kept-cards.js';
import type { CardSource } from './kept-cards.js';

export const EXTERNAL_SOURCE_MISSING_KEY = 'externalSourceMissingAt';
const MISSING_RECHECK_MS = 24 * 60 * 60_000;

export interface IssueReconcileSummary {
  projects: number;
  checked: number;
  updated: number;
  closed: number;
  missing: number;
  failed: number;
  errors: Array<{ projectId: string; workItemId?: string; error: string }>;
}

/**
 * Scope passed in by the caller. Providers that reconcile per-repository (like
 * GitHub, sharing target discovery with the PR reconciler) pass a target set
 * and a `matches(item, scope)` predicate. Providers with no repository concept
 * (Linear) pass no scope and every issue item is considered.
 */
export interface IssueReconcileScope<TScope> {
  scopes: TScope[];
  matches(item: Card, scope: TScope): boolean;
}

export interface IssueReconcilerOptions<TScope = void> {
  integrationId: string;
  intake: Intake;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: WorkItemsStorage;
  /**
   * Every project's provider-backed cards, kept between sweeps. With it a sweep
   * that finds nothing to change reads nothing from storage. Without it every
   * sweep lists the projects and reads each board.
   */
  cards?: CardSource;
  externalSource?(item: Card): { type: string; externalId: string };
  issueId(item: Card): string | undefined;
  metadata(
    item: Card,
    issue: IntakeIssue,
    dispatch: ResolvedIntakeDispatch,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * Called when a closed issue (stateType 'completed' or 'canceled') is detected
   * on a non-terminal work item. Use this to replay the close event through
   * the provider's rules ingress.
   */
  onClosed?(
    item: Card,
    issue: IntakeIssue,
    project: FactoryProject,
    dispatch: ResolvedIntakeDispatch,
  ): Promise<Record<string, unknown> | void>;
  /** Whether the item already rests in a terminal phase of its board. Unknown phases are not terminal. */
  isTerminal(item: Card): boolean;
  now?: () => Date;
}

export type IssueReconciler<TScope = void> = TScope extends void
  ? () => Promise<IssueReconcileSummary>
  : (scope: IssueReconcileScope<TScope>) => Promise<IssueReconcileSummary>;

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(right)) {
    if (!Array.isArray(left)) return right.length === 0;
    const leftStrings = left
      .filter((value): value is string => typeof value === 'string')
      .slice()
      .sort();
    const rightStrings = right
      .filter((value): value is string => typeof value === 'string')
      .slice()
      .sort();
    return (
      leftStrings.length === rightStrings.length && leftStrings.every((value, index) => value === rightStrings[index])
    );
  }
  if (right !== null && typeof right === 'object') {
    if (left === null || typeof left !== 'object' || Array.isArray(left)) return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
      leftKeys.length === rightKeys.length &&
      rightKeys.every(key => Object.hasOwn(leftRecord, key) && sameValue(leftRecord[key], rightRecord[key]))
    );
  }
  return left === right;
}

function metadataMatches(current: Record<string, unknown> | null, desired: Record<string, unknown>): boolean {
  return Object.entries(desired).every(([key, value]) => sameValue(current?.[key], value));
}

/**
 * Drop `undefined` entries so we never spread them into stored metadata. An
 * `undefined` field on the desired patch means "no signal from the live issue"
 * — we must preserve whatever was already stored, not clobber it.
 */
function withoutUndefined(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function withoutMissingMarker(record: Record<string, unknown> | null): Record<string, unknown> {
  const { [EXTERNAL_SOURCE_MISSING_KEY]: _missingAt, ...metadata } = record ?? {};
  return metadata;
}

function issueItems(project: FactoryProject, items: readonly Card[], integrationId: string): Card[] {
  return items.filter(
    item =>
      item.factoryProjectId === project.id &&
      item.externalSource?.integrationId === integrationId &&
      item.externalSource.type === 'issue',
  );
}

function cardMetadata(item: Card): Record<string, unknown> {
  return withoutMissingMarker({ ...item.workItem.metadata, ...item.metadata });
}

/**
 * The metadata a write of `item` builds on. A kept card may be older than the
 * stored one, and writing its metadata back would undo what changed since, so
 * the card is read again. Null when the card is gone.
 */
async function storedCardMetadata<TScope>(
  options: IssueReconcilerOptions<TScope>,
  project: FactoryProject,
  item: Card,
): Promise<Record<string, unknown> | null> {
  if (!options.cards) return cardMetadata(item);
  const stored = await options.storage.get({ orgId: project.orgId, id: item.id });
  return stored ? cardMetadata(stored) : null;
}

export function createIssueReconciler<TScope = void>(options: IssueReconcilerOptions<TScope>): IssueReconciler<TScope> {
  const now = options.now ?? (() => new Date());
  const run = async (scope?: IssueReconcileScope<TScope>): Promise<IssueReconcileSummary> => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };

    // A scoped sweep with zero targets is a no-op: the caller is telling us
    // there are no configured repositories to consider.
    if (scope && scope.scopes.length === 0) return summary;

    const cards = options.cards ?? storageCards({ projects: options.projects, workItems: options.storage });
    for (const project of await cards.projects()) {
      let all: readonly Card[];
      try {
        all = await cards.cards({ orgId: project.orgId, factoryProjectId: project.id });
      } catch (error) {
        // One project's unreadable cards must not end the sweep for every other project.
        summary.failed += 1;
        summary.errors.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const candidates = issueItems(project, all, options.integrationId);
      const items = scope
        ? candidates.filter(item => scope.scopes.some(target => scope.matches(item, target)))
        : candidates;
      if (items.length === 0) continue;
      summary.projects += 1;

      for (const item of items) {
        summary.checked += 1;
        try {
          const missingAt = item.workItem.metadata?.[EXTERNAL_SOURCE_MISSING_KEY];
          const missingTime = typeof missingAt === 'string' ? Date.parse(missingAt) : Number.NaN;
          const missingAge = now().getTime() - missingTime;
          if (Number.isFinite(missingTime) && missingAge >= 0 && missingAge < MISSING_RECHECK_MS) {
            summary.missing += 1;
            continue;
          }

          const resolved = await options.intake.resolveIntakeDispatch?.({
            orgId: project.orgId,
            externalSource: options.externalSource?.(item) ?? item.externalSource!,
          });
          if (!resolved) {
            await options.storage.syncCard({
              orgId: project.orgId,
              id: item.id,
              userId: 'factory-rule-dispatcher',
              patch: { metadata: { [EXTERNAL_SOURCE_MISSING_KEY]: now().toISOString() } },
            });
            summary.missing += 1;
            continue;
          }
          const issueId = options.issueId(item) ?? resolved.issueId;
          const issue = await options.intake.getIssue({ ...resolved, issueId });
          if (!issue) {
            await options.storage.syncCard({
              orgId: project.orgId,
              id: item.id,
              userId: 'factory-rule-dispatcher',
              patch: { metadata: { [EXTERNAL_SOURCE_MISSING_KEY]: now().toISOString() } },
            });
            summary.missing += 1;
            continue;
          }

          const hadMissingMarker = typeof missingAt === 'string';
          const baseMetadata = cardMetadata(item);
          // Close detection for Linear: replay through rules ingress if closed
          const isClosed = issue.stateType === 'completed' || issue.stateType === 'canceled';
          if (isClosed && !options.isTerminal(item) && options.onClosed) {
            const closedMetadata = withoutUndefined((await options.onClosed(item, issue, project, resolved)) ?? {});
            if (hadMissingMarker || !metadataMatches(baseMetadata, closedMetadata)) {
              const storedMetadata = await storedCardMetadata(options, project, item);
              if (!storedMetadata) continue;
              await options.storage.syncCard({
                orgId: project.orgId,
                id: item.id,
                userId: 'factory-rule-dispatcher',
                patch: {
                  metadata: {
                    ...storedMetadata,
                    ...closedMetadata,
                    ...(hadMissingMarker ? { [EXTERNAL_SOURCE_MISSING_KEY]: undefined } : {}),
                  },
                },
              });
              summary.updated += 1;
            }
            summary.closed += 1;
            continue;
          }

          const metadata = withoutUndefined(await options.metadata(item, issue, resolved));
          if (!hadMissingMarker && metadataMatches(baseMetadata, metadata)) continue;
          const storedMetadata = await storedCardMetadata(options, project, item);
          if (!storedMetadata) continue;
          await options.storage.syncCard({
            orgId: project.orgId,
            id: item.id,
            userId: 'factory-rule-dispatcher',
            patch: {
              metadata: {
                ...storedMetadata,
                ...metadata,
                ...(hadMissingMarker ? { [EXTERNAL_SOURCE_MISSING_KEY]: undefined } : {}),
              },
            },
          });
          summary.updated += 1;
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({
            projectId: project.id,
            workItemId: item.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return summary;
  };

  return run as IssueReconciler<TScope>;
}

/**
 * Reconciles only the provider's cards whose external id `matches`, e.g. the
 * one issue a provider event names. It still scans every project's cards to
 * find matches, but reads nothing from the provider for cards that don't match,
 * so an event for an untracked issue makes no provider call.
 */
export type IssueReconcileOne = (matches: (externalId: string) => boolean) => Promise<IssueReconcileSummary>;

export function createIssueReconcileOne(options: IssueReconcilerOptions): IssueReconcileOne {
  type Matcher = (externalId: string) => boolean;
  const run = createIssueReconciler<Matcher>(options);
  return matches =>
    run({
      scopes: [matches],
      matches: (item, matcher) => {
        const externalId = (options.externalSource?.(item) ?? item.externalSource)?.externalId;
        return externalId !== undefined && matcher(externalId);
      },
    });
}
