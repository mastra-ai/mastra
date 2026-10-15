import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Archive } from 'lucide-react';
import { useState } from 'react';

import { useFactoryAttentionHistory, useMarkAllFactoryAttentionRead } from '../../../../../hooks/useFactoryAttention';
import { NEEDS_YOU_KINDS, needsYouCounts } from '../../services/attention';
import type { FactoryAttentionView } from '../../services/attention';
import { PropertiesMenu } from '../../../../ui/PropertiesMenu';
import { AttentionItemRow } from '../AttentionItemRow';
import { PANEL } from '../panel';
import { RepositoryPickerDialog } from '../RepositoryPickerDialog';
import { useAttentionItemActions } from '../useAttentionItemActions';

/** Rows before the section folds, so a backlog cannot push the feed off the screen. */
const COLLAPSED_ROWS = 5;

type NeedsYouView = Exclude<FactoryAttentionView, 'unread'>;

const VIEW_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'archived', label: 'Archived' },
] satisfies Array<{ value: NeedsYouView; label: string }>;

export function NeedsYou({ factoryId }: { factoryId: string }) {
  const [view, setView] = useState<NeedsYouView>('open');
  const attention = useFactoryAttentionHistory(factoryId, view, NEEDS_YOU_KINDS);
  const kinds = attention.data?.pages[0]?.kinds;
  const counts = kinds ? needsYouCounts(kinds) : { open: 0, unread: 0 };
  const markAllRead = useMarkAllFactoryAttentionRead(factoryId);
  const archived = view === 'archived';

  return (
    <section aria-labelledby="needs-you-heading" className="flex flex-col gap-2">
      <div className="min-h-control-sm flex items-center gap-2">
        <Txt as="h2" variant="column" tone="ink" id="needs-you-heading" className="m-0">
          {archived ? 'Archived' : 'Needs you'}
        </Txt>
        {!archived && counts.open > 0 ? (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            className="bg-fill min-w-5 rounded-full px-1.5 py-0.5 text-center tabular-nums"
          >
            {counts.open}
          </Txt>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {!archived && counts.unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          ) : null}
          <PropertiesMenu
            label="Needs you properties"
            align="end"
            changedCount={archived ? 1 : 0}
            onReset={() => setView('open')}
          >
            <DropdownMenu.RadioSub
              label="Show"
              icon={<Archive aria-hidden />}
              options={VIEW_OPTIONS}
              value={view}
              onValueChange={setView}
            />
          </PropertiesMenu>
        </span>
      </div>
      <NeedsYouRows key={view} factoryId={factoryId} view={view} />
    </section>
  );
}

function NeedsYouRows({ factoryId, view }: { factoryId: string; view: NeedsYouView }) {
  const [expanded, setExpanded] = useState(false);
  const attention = useFactoryAttentionHistory(factoryId, view, NEEDS_YOU_KINDS);
  const actions = useAttentionItemActions(factoryId);

  if (attention.isPending) {
    return <Skeleton role="status" aria-label="Loading what needs you" className="h-14 w-full rounded-xl" />;
  }

  if (attention.isError) {
    return (
      <Notice variant="destructive">
        <span>Unable to load what needs you.</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => void attention.refetch()}>
          Try again
        </Button>
      </Notice>
    );
  }

  const items = attention.data.pages.flatMap(page => page.items);
  if (items.length === 0) {
    return (
      <Txt as="p" variant="caption" tone="muted" className="m-0">
        {view === 'archived' ? 'Nothing archived.' : 'Nothing needs you right now.'}
      </Txt>
    );
  }

  const shown = expanded ? items : items.slice(0, COLLAPSED_ROWS);
  const foldedCount = items.length - shown.length;
  const canLoadOlder = foldedCount === 0 && attention.hasNextPage;

  return (
    <>
      <ul className={`${PANEL} m-0 flex list-none flex-col px-3 py-1`}>
        {shown.map(item => (
          <li key={item.key}>
            <AttentionItemRow factoryId={factoryId} {...actions.rowProps(item)} />
          </li>
        ))}
        {foldedCount > 0 ? (
          <li className="py-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(true)}>
              Show {foldedCount} more
            </Button>
          </li>
        ) : null}
        {canLoadOlder ? (
          <li className="py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={attention.isFetchingNextPage}
              onClick={() => void attention.fetchNextPage()}
            >
              {attention.isFetchingNextPage ? 'Loading…' : 'Load older'}
            </Button>
          </li>
        ) : null}
      </ul>
      {actions.repositorySelection ? (
        <RepositoryPickerDialog
          repositories={actions.repositories}
          onClose={actions.closeRepositorySelection}
          onSelect={actions.selectRepository}
        />
      ) : null}
    </>
  );
}
