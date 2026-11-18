import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  SettingsContainer,
  SettingsItem,
  SettingsItemIcon,
  SettingsSkeleton,
} from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import type { IntakeOrderResponse, IntakeRouteInfo } from '../../../../api/types';
import { useIntakeOrderQuery, useSaveIntakeOrder } from '../../../../hooks/useIntakeOrder';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardRulesPath, INTAKE_ORDER_ANCHOR } from '../../boardConfig/boardConfigPaths';
import { newItemRules, ruleCount } from '../../boardRules/ruleLanes';
import { NotRoutedStep } from './NotRoutedStep';
import { SettingsSubsection } from './SettingsSubsection';
import { useRowDrag } from './useRowDrag';

const DROP_LINE = cn(
  'relative before:pointer-events-none before:absolute before:right-0 before:left-0 before:z-20 before:hidden before:h-0.5 before:rounded-full before:bg-border-focus',
  'data-[drop=before]:before:top-0 data-[drop=before]:before:block data-[drop=after]:before:bottom-0 data-[drop=after]:before:block',
);

/** The order intake offers a new issue or pull request to the project's boards. Changes show before they are saved. */
export function IntakeOrderSection({ factoryId }: { factoryId: string }) {
  const query = useIntakeOrderQuery(factoryId);

  return (
    <SettingsSubsection
      id={INTAKE_ORDER_ANCHOR}
      scope="factory"
      title="Intake order"
      description="A new issue or pull request is offered to each board in this order. The first board whose rules take it keeps it."
    >
      {query.isPending ? (
        <SettingsContainer>
          <SettingsSkeleton label="Loading intake order" variant="item" rows={3} />
        </SettingsContainer>
      ) : query.isError ? (
        <div className="flex flex-col gap-3">
          <Notice variant="destructive">The intake order didn’t load.</Notice>
          <div className="border-border rounded-xl border">
            <NotRoutedStep factoryId={factoryId} />
          </div>
        </div>
      ) : (
        // Keyed so an unsaved order never carries over to another project.
        <OrderEditor key={factoryId} factoryId={factoryId} order={query.data} />
      )}
    </SettingsSubsection>
  );
}

function OrderEditor({ factoryId, order }: { factoryId: string; order: IntakeOrderResponse }) {
  const routes = useIntakeRoutesQuery(factoryId);
  const save = useSaveIntakeOrder(factoryId);
  // Unset while the list shows what is saved; a drag or arrow starts a draft that Save or Discard ends.
  const [kept, setDraft] = useState<string[]>();
  const saved = order.boards.map(board => board.boardKey);
  // A draft only orders the boards it was made for: once a board is added or removed it is dropped, not saved short.
  const draft = kept && sameBoards(kept, saved) ? kept : undefined;
  const shown = draft ?? saved;
  const names = new Map(order.boards.map(board => [board.boardKey, board.name]));
  const changed = draft !== undefined && draft.some((key, index) => key !== saved[index]);

  const move = (from: number, to: number) => {
    const next = [...shown];
    const [key] = next.splice(from, 1);
    if (key === undefined) return;
    next.splice(to, 0, key);
    setDraft(next);
  };
  const drag = useRowDrag({ min: 0, max: shown.length - 1, onDrop: move });

  const onSave = () =>
    save.mutate(shown, {
      onSuccess: () => {
        setDraft(undefined);
        toast.success('Intake order saved.');
      },
      onError: error => toast.error(error.message),
    });

  const sortable = order.canEdit && shown.length > 1;
  // Held still while saving: a move made then would be cleared by the earlier save landing.
  const movable = sortable && !save.isPending;

  return (
    <div className="flex flex-col gap-3">
      <OrderStatus order={order} changed={changed} />
      {routes.isError && <Notice variant="warning">Rule counts didn’t load.</Notice>}
      <div className="border-border flex flex-col rounded-xl border">
        <SettingsContainer role="list" aria-label="Intake order">
          {shown.map((boardKey, index) => {
            const dragging = drag.drag?.from === index;
            const name = names.get(boardKey) ?? boardKey;
            return (
              <SettingsItem
                key={boardKey}
                role="listitem"
                data-drop={drag.dropAt(index)}
                style={dragging ? { transform: `translateY(${drag.drag?.offset ?? 0}px)` } : undefined}
                onPointerDown={movable ? pointer => drag.onPointerDown(pointer, index) : undefined}
                onKeyDown={movable ? key => drag.onKeyDown(key, index) : undefined}
                className={cn('group/row', DROP_LINE, dragging && 'z-10 opacity-90')}
                media={
                  <SettingsItemIcon>
                    <Txt
                      as="span"
                      variant="caption"
                      className={cn(
                        'tabular-nums',
                        sortable && 'pointer-fine:group-hover/row:hidden',
                        dragging && 'hidden',
                      )}
                    >
                      {index + 1}
                    </Txt>
                    {sortable && (
                      <span
                        data-grip
                        aria-hidden
                        className={cn(
                          'text-icon3 hidden cursor-grab touch-none pointer-fine:group-hover/row:inline-flex',
                          dragging && 'inline-flex',
                        )}
                      >
                        <GripVertical className="size-icon-md" />
                      </span>
                    )}
                  </SettingsItemIcon>
                }
                title={name}
                description={<RuleSummary routes={routes.data?.intakeRoutes} boardKey={boardKey} />}
              >
                <div className="flex items-center gap-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100">
                  {sortable && (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        tooltip="Check earlier"
                        disabled={!movable || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        tooltip="Check later"
                        disabled={!movable || index === shown.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowDown />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" render={<Link to={boardRulesPath(factoryId, boardKey)} />}>
                    Edit rules
                  </Button>
                </div>
              </SettingsItem>
            );
          })}
        </SettingsContainer>
        <NotRoutedStep factoryId={factoryId} />
      </div>
      {order.canEdit && changed && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDraft(undefined)} disabled={save.isPending}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} disabled={save.isPending}>
            Save order
          </Button>
        </div>
      )}
    </div>
  );
}

/** How many rules a board has for new issues and pull requests, and whether the last one takes everything left. */
function RuleSummary({ routes, boardKey }: { routes: IntakeRouteInfo[] | undefined; boardKey: string }) {
  if (!routes) return null;
  const { count, catchesAll } = newItemRules(routes.filter(route => route.target.boardKey === boardKey));
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>
        {count === 0
          ? 'No rules for new issues and pull requests'
          : `${ruleCount(count)} for new issues and pull requests`}
      </span>
      {catchesAll && <Badge>Ends in catch-all</Badge>}
    </span>
  );
}

/** Where the order came from, and how it files recent cards compared with the old Factory-wide route list. */
function OrderStatus({ order, changed }: { order: IntakeOrderResponse; changed: boolean }) {
  const { compared, differing, notRouted } = order.comparison;
  const lines: string[] = [];
  if (order.origin === 'derived') lines.push('Worked out from the old route list until someone saves an order.');
  if (compared > 0) {
    const lost = notRouted > 0 ? `, ${notRouted} of them Not routed` : '';
    lines.push(
      differing === 0
        ? `The last ${compared} cards land on the same boards as with the old route list.`
        : `Of the last ${compared} cards, ${differing} would land on another board than with the old route list${lost}.`,
    );
  }
  if (order.evaluator === 'route-list') lines.push('Intake still files cards by the old route list.');
  if (changed) lines.push('Not saved yet. The comparison is for the saved order.');
  if (lines.length === 0) return null;
  return (
    <Notice variant="info">
      <span className="flex flex-col gap-1">
        {lines.map(line => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </Notice>
  );
}

function sameBoards(draft: readonly string[], saved: readonly string[]): boolean {
  const keys = new Set(saved);
  return draft.length === saved.length && draft.every(key => keys.has(key));
}
