import {
  AddRuleRow,
  BoardStatsRow,
  CanvasFrame,
  CanvasToolbar,
  IntakeOrderList,
  IntakeOrderStatus,
  IntakeReorderButtons,
  NewRuleRow,
  OrderBoardCard,
  OrderCardHeader,
  SourceLinks,
  StackLink,
  TestInput,
  UnsavedPill,
} from '@mastra/playground-ui/domains/factory';
import type { BoardStats } from '@mastra/playground-ui/domains/factory';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useNavigate, useSearchParams } from 'react-router';

import type { IntakeDryRunResponse } from '../../../../../api/types';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useIntakeDryRunQuery } from '../../../../../hooks/useIntakeDryRun';
import { useIntakeRoutesQuery } from '../../../../../hooks/useIntakeRoutes';
import { HrefLink } from '../../../../ui/HrefLink';
import {
  boardConfigPath,
  boardIntakePath,
  INTAKE_ORDER_ANCHOR,
  readCanvasFocus,
} from '../../../boardConfig/boardConfigPaths';
import type { CanvasFocus } from '../../../boardConfig/boardConfigPaths';
import { phaseName } from '../../../boardRules/ruleTargets';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { BoardSettingsTabs } from '../BoardSettingsTabs';
import { NotRoutedCard } from './NotRoutedCard';
import { OrderRuleList } from './OrderRuleList';
import { RerouteNotice } from './RerouteNotice';
import { RoutingPanel } from './RoutingPanel';
import { SourcesColumn } from './SourcesColumn';
import { useOrderDraft } from './useOrderDraft';
import { useOrderLines } from './useOrderLines';

/**
 * A board's routing: where new issues and pull requests come from, the order boards are asked in with each board's
 * rules for them, and what no board took. Mount it with a `key` per project: an unsaved order belongs to one.
 */
export function RoutingPage({
  factoryId,
  boardId,
  repositories,
}: {
  factoryId: string;
  boardId: string;
  repositories: readonly LinkedRepositoryPayload[];
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focus = readCanvasFocus(searchParams);
  const go = (next?: CanvasFocus) => navigate(boardIntakePath(factoryId, boardId, { focus: next }));

  const draft = useOrderDraft(factoryId);
  const routesQuery = useIntakeRoutesQuery(factoryId);
  const dryRun = useIntakeDryRunQuery(factoryId).data;
  const catalog = useBoardCatalog(factoryId).data ?? [];
  const { lines, filedByEvent } = useOrderLines(factoryId, draft.shown);

  const order = draft.query.data;
  const canEditRules = routesQuery.data?.canEdit ?? false;
  const names = new Map(order?.boards.map(board => [board.boardKey, board.name]));
  const stats = boardStats(dryRun, boardId);
  const newRule = focus && 'newRule' in focus ? focus.newRule : undefined;
  const newRuleBoard = newRule && (newRule.board ?? boardId);
  const testSubject = focus && 'test' in focus ? focus.test : undefined;

  return (
    <CanvasFrame
      label="Routing"
      tabs={<BoardSettingsTabs factoryId={factoryId} boardId={boardId} active="routing" />}
      panel={
        focus
          ? {
              content: <RoutingPanel factoryId={factoryId} boardId={boardId} focus={focus} onFocus={go} />,
              onClose: () => go(),
            }
          : undefined
      }
      bar={
        <>
          {order?.canEdit && draft.changed && (
            <UnsavedPill
              label="Order not saved"
              saveLabel="Save order"
              saving={draft.saving}
              onSave={draft.save}
              onDiscard={draft.discard}
            />
          )}
          <CanvasToolbar>
            <TestInput key={testSubject} defaultValue={testSubject} onTest={subject => go({ test: subject })} />
          </CanvasToolbar>
        </>
      }
    >
      <div className="relative mx-auto flex w-max items-start gap-16 max-sm:w-full max-sm:flex-col max-sm:gap-10">
        <SourcesColumn
          factoryId={factoryId}
          repositories={repositories}
          filed={filedByEvent}
          routeList={order?.evaluator === 'route-list'}
        />

        <section
          id={INTAKE_ORDER_ANCHOR}
          aria-label="Intake order"
          className="flex w-115 shrink-0 scroll-mt-4 flex-col gap-3 max-sm:w-full"
        >
          <Txt as="h2" variant="column" tone="muted" className="flex h-5 items-center">
            Intake order
          </Txt>
          {draft.query.isError && <Notice variant="destructive">The intake order didn’t load.</Notice>}
          {routesQuery.isError && <Notice variant="warning">Rules didn’t load.</Notice>}
          <RerouteNotice factoryId={factoryId} canEdit={canEditRules} boardNames={names} />
          {order && <IntakeOrderStatus order={order} changed={draft.changed} />}
          {order && !draft.saved.includes(boardId) && (
            <Notice variant="info">
              Not in the intake order: new issues and pull requests never reach this board.
            </Notice>
          )}

          {/* The order, then what no board took: each card linked to the one before it. */}
          <div data-link-order className="flex flex-col">
            <IntakeOrderList
              boards={draft.shown}
              movable={draft.movable}
              onMove={draft.move}
              renderBoard={(boardKey, { index, dragging }) => {
                const current = boardKey === boardId;
                const name = names.get(boardKey) ?? boardKey;
                const board = catalog.find(entry => entry.id === boardKey);
                return (
                  <OrderBoardCard
                    name={name}
                    current={current}
                    dragging={dragging}
                    header={
                      <OrderCardHeader
                        name={name}
                        current={current}
                        place={index + 1}
                        grip={draft.movable}
                        dragging={dragging}
                        routingHref={boardIntakePath(factoryId, boardKey)}
                        rulesHref={boardConfigPath(factoryId, boardKey)}
                        LinkComponent={HrefLink}
                      >
                        {draft.sortable && (
                          <IntakeReorderButtons
                            earlier={draft.movable && index > 0}
                            later={draft.movable && index < draft.shown.length - 1}
                            onMove={by => draft.move(index, index + by)}
                          />
                        )}
                      </OrderCardHeader>
                    }
                  >
                    <OrderRuleList
                      name={name}
                      lines={lines?.get(boardKey)}
                      board={board}
                      last={index === draft.shown.length - 1}
                      onOpenRule={routeId => go({ rule: routeId })}
                    >
                      {newRule && newRuleBoard === boardKey && (
                        <NewRuleRow phase={newRule.into && phaseName(board, newRule.into)} />
                      )}
                      {current && stats && <BoardStatsRow stats={stats} />}
                      {current && canEditRules && newRuleBoard !== boardKey && (
                        <AddRuleRow onAdd={() => go({ newRule: { board: boardKey } })} />
                      )}
                    </OrderRuleList>
                  </OrderBoardCard>
                );
              }}
            />
            {draft.shown.length > 0 && <StackLink />}
            <NotRoutedCard factoryId={factoryId} onWhy={decisionId => go({ test: decisionId })} />
          </div>
        </section>
        <SourceLinks />
      </div>
    </CanvasFrame>
  );
}

/** How the board fared in the dry run; undefined until it has run or when the board isn't in it. */
function boardStats(dryRun: IntakeDryRunResponse | undefined, boardKey: string): BoardStats | undefined {
  const run = dryRun?.boards.find(board => board.boardKey === boardKey);
  if (!dryRun || !run) return undefined;
  return {
    sampled: dryRun.sampled,
    takes: run.takes.length,
    lost: run.lostTo.reduce((sum, entry) => sum + entry.keys.length, 0),
  };
}
