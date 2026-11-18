import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { useIntakeOrderQuery, useSkippedRulesQuery } from '../../../../hooks/useIntakeOrder';
import { useBoardRulesQuery, useIntakeRoutesQuery, useIntakeRouteWrites } from '../../../../hooks/useIntakeRoutes';
import type { RouteWrite } from '../../../../hooks/useIntakeRoutes';
import { boardRulesPath, RULES_INTO_PARAM, RULES_LEAVING_PARAM } from '../../boardConfig/boardConfigPaths';
import { boardFlow } from '../boardFlow';
import { phaseName, phaseOptions, reorderWithin } from '../ruleTargets';
import { arrivalFallback, isOpenedLane, LANE_SECTIONS, laneRules, shadowedBy } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { IncomingRules } from './IncomingRules';
import { IntakeChain } from './IntakeChain';
import { RuleBuilderDialog } from './RuleBuilderDialog';
import type { RuleDraft, RuleStep } from './RuleBuilderDialog';
import { IntoFilter } from './IntoFilter';
import { RuleLane } from './RuleLane';
import type { RuleFocus } from './RuleLane';

const STALE_CODES = new Set(['revision_mismatch', 'intake_route_set_mismatch', 'intake_route_not_found']);

type Editing = { rule?: IntakeRouteInfo; event?: RuleEvent; step: RuleStep };

function isStale(error: unknown): boolean {
  return error instanceof BoardRequestError && error.code !== undefined && STALE_CODES.has(error.code);
}

function failureMessage(error: unknown): string {
  if (isStale(error)) {
    return 'Someone else changed these rules first. They have been reloaded; try again.';
  }
  return error instanceof Error ? error.message : 'The change didn’t save.';
}

/** Every rule of one board, one lane per trigger. */
export function BoardRules({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  const catalog = useBoardCatalog(factoryId);
  const board = catalog.data?.find(candidate => candidate.id === boardId);

  if (catalog.isPending) return <Skeleton className="h-64 w-full" />;
  if (catalog.isError) return <Notice variant="destructive">Boards didn’t load.</Notice>;
  if (!board) return <Notice variant="warning">This board isn’t installed.</Notice>;
  // Keyed so an open rule never outlives the board it belongs to when the page moves to another one.
  return <BoardLanes key={`${factoryId}:${board.id}`} factoryId={factoryId} board={board} boards={catalog.data} />;
}

function BoardLanes({
  factoryId,
  board,
  boards,
}: {
  factoryId: string;
  board: InstalledBoardInfo;
  boards: readonly InstalledBoardInfo[];
}) {
  const query = useBoardRulesQuery(factoryId, board.id);
  const projectRules = useIntakeRoutesQuery(factoryId);
  const order = useIntakeOrderQuery(factoryId);
  const skipped = useSkippedRulesQuery(factoryId);
  const writes = useIntakeRouteWrites(factoryId);
  const [editing, setEditing] = useState<Editing>();
  // The open rule, read after a save returns: a save finishing after its rule was closed must not touch the next one.
  const session = useRef<Editing>(undefined);
  const edit = (next?: Editing) => {
    session.current = next;
    setEditing(next);
  };
  const [saveError, setSaveError] = useState<string>();
  const rules = query.data?.intakeRoutes ?? [];
  const canEdit = query.data?.canEdit ?? false;
  const options = phaseOptions(board);
  const incoming = (projectRules.data?.intakeRoutes ?? []).filter(
    rule => rule.target.moveToBoardKey === board.id && rule.target.boardKey !== board.id,
  );
  const skips = new Map(skipped.data?.skipped.map(skip => [skip.routeId, skip]));
  const [params] = useSearchParams();
  const into = params.get(RULES_INTO_PARAM) ?? undefined;
  const leaving = params.has(RULES_LEAVING_PARAM);
  const focused = leaving || into !== undefined;
  const flow =
    focused && projectRules.data
      ? boardFlow(projectRules.data.intakeRoutes, { key: board.id, initialPhase: board.initialPhase })
      : undefined;
  const only = flow && new Set((leaving ? flow.leaving : (flow.into.get(into ?? '') ?? [])).map(rule => rule.id));
  const shows = (lane: readonly IntakeRouteInfo[]) => !only || lane.some(rule => only.has(rule.id));

  if (query.isPending || (focused && projectRules.isPending)) return <Skeleton className="h-64 w-full" />;
  if (query.isError) return <Notice variant="destructive">This board’s rules didn’t load.</Notice>;

  const run = (changes: RouteWrite[]) => writes.mutateAsync(changes).catch(error => toast.error(failureMessage(error)));

  const move = (event: RuleEvent, from: number, to: number) => {
    const lane = laneRules(rules, event).map(rule => rule.id);
    void run([{ kind: 'reorder', boardKey: board.id, ids: reorderWithin(rules, lane, from, to) }]);
  };

  const open = (next: Editing) => {
    setSaveError(undefined);
    edit(next);
  };

  const save = async (draft: RuleDraft) => {
    const started = session.current;
    const rule = started?.rule;
    const current = () => started !== undefined && session.current === started;
    setSaveError(undefined);
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
      } else {
        const [created] = await writes.mutateAsync([
          { kind: 'create', route: { ...draft, target: { boardKey: board.id, ...draft.target } } },
        ]);
        // The rule exists from here on: a failed move must not leave the dialog open to create it twice.
        if (current()) edit(undefined);
        if (created) await keepAboveCatchAll(created, draft.on).catch(error => toast.error(failureMessage(error)));
        return;
      }
      if (current()) edit(undefined);
    } catch (error) {
      if (!current()) return;
      if (rule && isStale(error)) return reopenFresh(rule);
      setSaveError(failureMessage(error));
    }
  };

  // Someone changed the rule first: show their version rather than resend this one over it with a stale revision.
  const reopenFresh = async (stale: IntakeRouteInfo) => {
    const started = session.current;
    const fresh = (await query.refetch()).data?.intakeRoutes.find(candidate => candidate.id === stale.id);
    if (!started || session.current !== started) return;
    if (!fresh) {
      edit(undefined);
      toast.error('Someone else deleted this rule first.');
      return;
    }
    edit({ ...started, rule: fresh });
    setSaveError('Someone else changed this rule first. It now shows their version; make your change again.');
  };

  // A new rule goes in at the end of its board's list; one under a rule that hides it would never be reached, so it
  // moves up to just above the earliest such rule in any lane it listens on. The board has one order shared by
  // every lane, so one slot keeps it above all of them.
  const keepAboveCatchAll = async (created: IntakeRouteInfo, on: readonly RuleEvent[]) => {
    if (created.target.boardKey !== board.id) return;
    const fresh = (await query.refetch()).data?.intakeRoutes ?? [];
    const ids = fresh.map(rule => rule.id);
    const at = ids.indexOf(created.id);
    const catchAlls = on.flatMap(event => {
      const lane = laneRules(fresh, event);
      const hider =
        lane[
          shadowedBy(
            lane,
            event,
            lane.findIndex(rule => rule.id === created.id),
          )
        ];
      return hider ? [ids.indexOf(hider.id)] : [];
    });
    const above = Math.min(...catchAlls);
    if (at < 0 || !(above < at)) return;
    await writes.mutateAsync([{ kind: 'reorder', boardKey: board.id, ids: reorderWithin(fresh, ids, at, above) }]);
  };

  const arrivalFooter =
    order.data?.evaluator === 'route-list'
      ? 'Otherwise: the old route list decides'
      : arrivalFallback(order.data?.boards, board.id);

  return (
    <div className="flex flex-col gap-8">
      {projectRules.isError && (
        <Notice variant="warning">Rules on other boards that move cards here didn’t load, so they aren’t shown.</Notice>
      )}
      {focused && (
        <IntoFilter
          count={only?.size}
          into={leaving || !into ? 'other boards' : (phaseName(board, into) ?? into)}
          leaving={leaving}
          showAll={boardRulesPath(factoryId, board.id)}
        />
      )}
      {LANE_SECTIONS.filter(section =>
        section.events.some(event => shows([...laneRules(rules, event), ...laneRules(incoming, event)])),
      ).map(section => (
        <section key={section.title} aria-label={section.title} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Txt as="h2" variant="subheading" tone="ink">
              {section.title}
            </Txt>
            {section.events.some(isOpenedLane) ? (
              order.data && (
                <IntakeChain
                  factoryId={factoryId}
                  boardKey={board.id}
                  order={order.data.boards}
                  evaluator={order.data.evaluator}
                />
              )
            ) : (
              <Txt as="p" variant="caption" tone="muted">
                Only cards already on this board; other boards never see them.
              </Txt>
            )}
          </div>
          {section.events.map(event => {
            const opened = isOpenedLane(event);
            const lane = laneRules(rules, event);
            const arriving = laneRules(incoming, event).filter(rule => !only || only.has(rule.id));
            if (!shows([...lane, ...arriving])) return null;
            return (
              <RuleLane
                key={event}
                event={event}
                rules={lane}
                board={board}
                boards={boards}
                phaseOptions={options}
                canEdit={canEdit}
                skips={skips}
                footer={opened ? arrivalFooter : undefined}
                only={only}
                incoming={
                  arriving.length ? (
                    <IncomingRules factoryId={factoryId} rules={arriving} board={board} boards={boards} />
                  ) : undefined
                }
                onEdit={(rule, focus: RuleFocus) => open({ rule, step: focus })}
                onAdd={() => open({ event, step: 'conditions' })}
                onMove={(from, to) => move(event, from, to)}
                onToggle={(rule, enabled) =>
                  void run([{ kind: 'update', id: rule.id, patch: { enabled, expectedRevision: rule.revision } }])
                }
                onDelete={rule =>
                  void run([{ kind: 'delete', id: rule.id, expectedRevision: rule.revision }]).then(
                    done => done && toast.success(`Deleted “${rule.name}”`),
                  )
                }
                onUngate={rule =>
                  void run([
                    {
                      kind: 'update',
                      id: rule.id,
                      patch: { outsiderPullRequestsGated: false, expectedRevision: rule.revision },
                    },
                  ]).then(done => done && toast.success(`“${rule.name}” now matches outside authors’ pull requests`))
                }
              />
            );
          })}
        </section>
      ))}

      {editing && (
        <RuleBuilderDialog
          // A reloaded rule has a new revision, so the dialog starts over from it.
          key={editing.rule ? `${editing.rule.id}:${editing.rule.revision}` : `new-${editing.event}`}
          factoryId={factoryId}
          board={board}
          boards={boards}
          initial={editing.rule}
          initialEvent={editing.event}
          initialStep={editing.step}
          readOnly={!canEdit}
          saving={writes.isPending}
          error={saveError}
          onSave={draft => void save(draft)}
          onClose={() => edit(undefined)}
        />
      )}
    </div>
  );
}
