import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { BoardRequestError } from '../../../../hooks/useBoardEditor';
import { useIntakeOrderQuery, useSkippedRulesQuery } from '../../../../hooks/useIntakeOrder';
import { useBoardRulesQuery, useIntakeRouteWrites } from '../../../../hooks/useIntakeRoutes';
import type { RouteWrite } from '../../../../hooks/useIntakeRoutes';
import { phaseOptions, reorderWithin } from '../ruleTargets';
import { INTAKE_ORDER_ANCHOR, settingsSectionPath } from '../../settings/settingsSections';
import { alsoFilesCardless, catchAllIndex, intakePosition, isOpenedLane, LANE_EVENTS, laneRules } from '../ruleLanes';
import type { RuleEvent } from '../ruleLanes';
import { RuleBuilderDialog } from './RuleBuilderDialog';
import type { RuleDraft, RuleStep } from './RuleBuilderDialog';
import { RuleLane } from './RuleLane';
import type { RuleFocus } from './RuleLane';

const STALE_CODES = new Set(['revision_mismatch', 'intake_route_set_mismatch', 'intake_route_not_found']);

type Editing = { rule?: IntakeRouteInfo; event?: RuleEvent; step: RuleStep };

function failureMessage(error: unknown): string {
  if (error instanceof BoardRequestError && error.code && STALE_CODES.has(error.code)) {
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
  return <BoardLanes factoryId={factoryId} board={board} boards={catalog.data} />;
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
  const order = useIntakeOrderQuery(factoryId);
  const skipped = useSkippedRulesQuery(factoryId);
  const writes = useIntakeRouteWrites(factoryId);
  const [editing, setEditing] = useState<Editing>();
  const [saveError, setSaveError] = useState<string>();
  const rules = query.data?.intakeRoutes ?? [];
  const canEdit = query.data?.canEdit ?? false;
  const options = phaseOptions(board);
  const skips = new Map(skipped.data?.skipped.map(skip => [skip.routeId, skip]));

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) return <Notice variant="destructive">This board’s rules didn’t load.</Notice>;

  const run = (changes: RouteWrite[]) => writes.mutateAsync(changes).catch(error => toast.error(failureMessage(error)));

  const move = (event: RuleEvent, from: number, to: number) => {
    const lane = laneRules(rules, event).map(rule => rule.id);
    void run([{ kind: 'reorder', boardKey: board.id, ids: reorderWithin(rules, lane, from, to) }]);
  };

  const open = (next: Editing) => {
    setSaveError(undefined);
    setEditing(next);
  };

  const save = async (draft: RuleDraft) => {
    const rule = editing?.rule;
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
        setEditing(undefined);
        if (created) await keepAboveCatchAll(created, draft.on[0]).catch(error => toast.error(failureMessage(error)));
        return;
      }
      setEditing(undefined);
    } catch (error) {
      setSaveError(failureMessage(error));
    }
  };

  // A new rule goes in at the end of its board's list; one under a rule taking everything would never be reached,
  // so it moves up to just above that rule, as the server does for new items.
  const keepAboveCatchAll = async (created: IntakeRouteInfo, event: RuleEvent | undefined) => {
    if (created.target.boardKey !== board.id || event === undefined) return;
    const fresh = (await query.refetch()).data?.intakeRoutes ?? [];
    const lane = laneRules(fresh, event);
    const catchAll = catchAllIndex(lane);
    const at = lane.findIndex(rule => rule.id === created.id);
    if (catchAll < 0 || at < catchAll) return;
    const ids = reorderWithin(
      fresh,
      lane.map(rule => rule.id),
      at,
      catchAll,
    );
    await writes.mutateAsync([{ kind: 'reorder', boardKey: board.id, ids }]);
  };

  const position = order.data ? intakePosition(order.data.boards, board.id) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {LANE_EVENTS.map(event => {
        const opened = isOpenedLane(event);
        const lane = laneRules(rules, event);
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
            note={
              opened ? (
                <>
                  <Txt as="p" variant="caption" tone="muted">
                    No card yet.{' '}
                    {position && (
                      <Link to={settingsSectionPath(factoryId, 'intake', INTAKE_ORDER_ANCHOR)} className="underline">
                        {position}
                      </Link>
                    )}
                  </Txt>
                  <Txt as="p" variant="caption" tone="muted" className="mt-2 flex gap-1.5">
                    <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                    Pull requests that close an issue with a card join that card automatically. Rules below decide what
                    runs on them.
                  </Txt>
                </>
              ) : alsoFilesCardless(event) ? (
                <Txt as="p" variant="caption" tone="muted">
                  Also files items with no card.
                </Txt>
              ) : undefined
            }
            footer={opened ? 'Otherwise: checked by the next board, then Not routed' : undefined}
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
          />
        );
      })}

      {editing && (
        <RuleBuilderDialog
          key={editing.rule?.id ?? `new-${editing.event}`}
          board={board}
          boards={boards}
          initial={editing.rule}
          initialEvent={editing.event}
          initialStep={editing.step}
          readOnly={!canEdit}
          saving={writes.isPending}
          error={saveError}
          onSave={draft => void save(draft)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
