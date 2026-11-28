import type { IntakeDryRunResponse } from '@mastra/client-js';
import { useBoardCatalog, useIntakeRoutesQuery, useIntakeDryRunQuery } from '@mastra/react/hooks/factory';
import {
  AddRuleRow,
  BoardSettingsTabs,
  BoardStatsRow,
  CanvasFrame,
  CanvasToolbar,
  INTAKE_ORDER_ANCHOR,
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
  phaseName,
  readCanvasFocus,
  useBoardSettingsHost,
} from '..';
import type { BoardStats, CanvasFocus } from '..';

import { RoutingNotRoutedCard } from './routing-not-routed-card';
import { RoutingOrderRuleList } from './routing-order-rule-list';
import { RoutingPanel } from './routing-panel';
import { RoutingRerouteNotice } from './routing-reroute-notice';
import { RoutingSourcesColumn } from './routing-sources-column';
import { useOrderDraft } from './use-order-draft';
import { useOrderLines } from './use-order-lines';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

/**
 * A board's routing: where new issues and pull requests come from, the order boards are asked in with each board's
 * rules for them, and what no board took. Mount it with a `key` per project: an unsaved order belongs to one.
 */
export function RoutingPage({ factoryId, boardId }: { factoryId: string; boardId: string }) {
  const host = useBoardSettingsHost();
  const focus = readCanvasFocus(host.searchParams);
  const go = (next?: CanvasFocus) => host.navigate(host.routingHref(boardId, { focus: next }));

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
      tabs={<BoardSettingsTabs boardId={boardId} active="routing" />}
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
        <RoutingSourcesColumn filed={filedByEvent} routeList={order?.evaluator === 'route-list'} />

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
          <RoutingRerouteNotice factoryId={factoryId} canEdit={canEditRules} boardNames={names} />
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
                        routingHref={host.routingHref(boardKey)}
                        rulesHref={host.configHref(boardKey)}
                        LinkComponent={host.LinkComponent}
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
                    <RoutingOrderRuleList
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
                    </RoutingOrderRuleList>
                  </OrderBoardCard>
                );
              }}
            />
            {draft.shown.length > 0 && <StackLink />}
            <RoutingNotRoutedCard factoryId={factoryId} onWhy={decisionId => go({ test: decisionId })} />
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
