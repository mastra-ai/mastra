import { toast } from '@mastra/playground-ui/components/Toaster';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../api/keys';
import type { IntakeRouteInfo, IntakeRouteListResponse } from '../../../api/types';
import { BoardRequestError } from '../../../hooks/useBoardEditor';
import { useIntakeRoutesQuery, useIntakeRouteWrites } from '../../../hooks/useIntakeRoutes';
import type { RouteWrite } from '../../../hooks/useIntakeRoutes';
import { laneRules } from '../boardRules/ruleLanes';
import type { RuleEvent } from '../boardRules/ruleLanes';
import { reorderWithin } from '../boardRules/ruleTargets';
import { boardRulesOf } from './canvasModel';
import { slotAboveCatchAll } from './ruleDraft';
import type { RuleDraft } from './ruleDraft';

const STALE_CODES: Record<string, true> = {
  revision_mismatch: true,
  intake_route_set_mismatch: true,
  intake_route_not_found: true,
};

export const CHANGED_FIRST =
  'Someone else changed this rule first. It now shows their version; make your change again.';
export const DELETED_FIRST = 'Someone else deleted this rule first.';

function isStale(error: unknown): boolean {
  return error instanceof BoardRequestError && error.code !== undefined && STALE_CODES[error.code] === true;
}

function failureMessage(error: unknown): string {
  if (isStale(error)) {
    return 'Someone else changed these rules first. They have been reloaded; try again.';
  }
  return error instanceof Error ? error.message : 'The change didn’t save.';
}

export type SaveOutcome =
  | { kind: 'saved' }
  /** Someone changed the rule first: their version, to show instead of resending this one with a stale revision. */
  | { kind: 'fresh'; rule: IntakeRouteInfo }
  /** Someone deleted the rule first. */
  | { kind: 'gone' }
  | { kind: 'failed'; message: string };

/** The instant writes answer with the project's rules after the change; undefined when it failed. */
export interface RuleWrites {
  pending: boolean;
  move: (boardKey: string, event: RuleEvent, from: number, to: number) => Promise<IntakeRouteInfo[] | undefined>;
  toggle: (rule: IntakeRouteInfo, enabled: boolean) => Promise<IntakeRouteInfo[] | undefined>;
  ungate: (rule: IntakeRouteInfo) => Promise<IntakeRouteInfo[] | undefined>;
  /** Whether the rule is gone now: deleted here, or by someone else first. */
  remove: (rule: IntakeRouteInfo) => Promise<boolean>;
  /**
   * Saves the whole rule: `rule` is the version the edit started from, so a change someone made since comes back as
   * `fresh`. A new rule goes on `boardKey`; `onCreated` hears of it as soon as it exists, before it moves up.
   */
  save: (
    draft: RuleDraft,
    options: { rule?: IntakeRouteInfo; boardKey: string; onCreated: (rule: IntakeRouteInfo) => void },
  ) => Promise<SaveOutcome>;
}

/**
 * Every change the rule panel makes. The switch, the arrows, Delete and "Let outside authors match" apply at once
 * and say a failure in a toast; Save reports how it went so the panel can show it in place.
 */
export function useRuleWrites(factoryId: string): RuleWrites {
  const routes = useIntakeRoutesQuery(factoryId);
  const writes = useIntakeRouteWrites(factoryId);
  const queryClient = useQueryClient();

  // The writes reload the routes before they settle, failed or not, so the cache holds the rules as they are now.
  const savedRoutes = () =>
    queryClient.getQueryData<IntakeRouteListResponse>(queryKeys.intakeRoutes(factoryId))?.intakeRoutes ?? [];

  const run = (changes: RouteWrite[]): Promise<IntakeRouteInfo[] | undefined> =>
    writes.mutateAsync(changes).then(savedRoutes, error => {
      toast.error(failureMessage(error));
      return undefined;
    });

  const move = (boardKey: string, event: RuleEvent, from: number, to: number) => {
    const boardRules = boardRulesOf(routes.data?.intakeRoutes ?? [], boardKey);
    const lane = laneRules(boardRules, event).map(rule => rule.id);
    return run([{ kind: 'reorder', boardKey, ids: reorderWithin(boardRules, lane, from, to) }]);
  };

  const toggle = (rule: IntakeRouteInfo, enabled: boolean) =>
    run([{ kind: 'update', id: rule.id, patch: { enabled, expectedRevision: rule.revision } }]);

  const ungate = async (rule: IntakeRouteInfo) => {
    const done = await run([
      { kind: 'update', id: rule.id, patch: { outsiderPullRequestsGated: false, expectedRevision: rule.revision } },
    ]);
    if (done) toast.success(`“${rule.name}” now matches outside authors’ pull requests`);
    return done;
  };

  const remove = (rule: IntakeRouteInfo): Promise<boolean> =>
    writes.mutateAsync([{ kind: 'delete', id: rule.id, expectedRevision: rule.revision }]).then(
      () => {
        toast.success(`Deleted “${rule.name}”`);
        return true;
      },
      error => {
        const gone = error instanceof BoardRequestError && error.code === 'intake_route_not_found';
        toast.error(gone ? DELETED_FIRST : failureMessage(error));
        return gone;
      },
    );

  // A new rule goes in at the end of its board's list; one under a rule that hides it would never be reached.
  const keepAboveCatchAll = async (created: IntakeRouteInfo, on: readonly RuleEvent[]) => {
    const fresh = boardRulesOf(savedRoutes(), created.target.boardKey);
    const above = slotAboveCatchAll(fresh, created.id, on);
    if (above === undefined) return;
    const ids = fresh.map(rule => rule.id);
    await writes.mutateAsync([
      {
        kind: 'reorder',
        boardKey: created.target.boardKey,
        ids: reorderWithin(fresh, ids, ids.indexOf(created.id), above),
      },
    ]);
  };

  const save: RuleWrites['save'] = async (draft, { rule, boardKey, onCreated }) => {
    try {
      if (rule) {
        await writes.mutateAsync([
          {
            kind: 'update',
            id: rule.id,
            patch: {
              name: draft.name,
              on: draft.on,
              when: draft.when,
              // A rule that joined a pull request to its issue's card keeps doing so: there is no switch for it now.
              target: { boardKey: rule.target.boardKey, ...draft.target, joinClosedIssue: rule.target.joinClosedIssue },
              expectedRevision: rule.revision,
            },
          },
        ]);
        return { kind: 'saved' };
      }
      const [created] = await writes.mutateAsync([
        { kind: 'create', route: { ...draft, target: { boardKey, ...draft.target } } },
      ]);
      // The rule exists from here on: a failed move must not leave it open to create it twice.
      if (created) {
        onCreated(created);
        await keepAboveCatchAll(created, draft.on).catch(error => toast.error(failureMessage(error)));
      }
      return { kind: 'saved' };
    } catch (error) {
      if (rule && isStale(error)) {
        const fresh = savedRoutes().find(candidate => candidate.id === rule.id);
        return fresh ? { kind: 'fresh', rule: fresh } : { kind: 'gone' };
      }
      return { kind: 'failed', message: failureMessage(error) };
    }
  };

  return { pending: writes.isPending, move, toggle, ungate, remove, save };
}
