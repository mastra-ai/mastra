import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Archive } from 'lucide-react';

import {
  useFactoryAttentionSummary,
  useMarkAllFactoryAttentionRead,
} from '../../../../../../hooks/useFactoryAttention';
import { PropertiesMenu } from '../../../../../ui/PropertiesMenu';
import { ATTENTION_KINDS, attentionCounts, NEEDS_YOU_KINDS } from '../../../services/attention';
import type { FactoryAttentionView } from '../../../services/attention';

export type NeedsYouView = Exclude<FactoryAttentionView, 'unread'>;

const VIEW_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'archived', label: 'Archived' },
] satisfies Array<{ value: NeedsYouView; label: string }>;

export function NeedsYouHeader({
  factoryId,
  view,
  onViewChange,
}: {
  factoryId: string;
  view: NeedsYouView;
  onViewChange: (view: NeedsYouView) => void;
}) {
  const summary = useFactoryAttentionSummary(factoryId);
  const markAllRead = useMarkAllFactoryAttentionRead(factoryId);
  const archived = view === 'archived';
  const waitingCount = summary.data ? attentionCounts(summary.data, NEEDS_YOU_KINDS).open : 0;
  const unreadCount = summary.data ? attentionCounts(summary.data, ATTENTION_KINDS).unread : 0;

  return (
    <div className="min-h-control-sm flex items-center gap-2">
      <Txt as="h2" variant="column" tone="ink" id="needs-you-heading" className="m-0">
        {archived ? 'Archived' : 'Needs you'}
      </Txt>
      {!archived && waitingCount > 0 ? (
        <Txt
          as="span"
          variant="meta"
          tone="muted"
          className="bg-fill min-w-5 rounded-full px-1.5 py-0.5 text-center tabular-nums"
        >
          {waitingCount}
        </Txt>
      ) : null}
      <span className="ml-auto flex items-center gap-1">
        {!archived && unreadCount > 0 ? (
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
          onReset={() => onViewChange('open')}
        >
          <DropdownMenu.RadioSub
            label="Show"
            icon={<Archive aria-hidden />}
            options={VIEW_OPTIONS}
            value={view}
            onValueChange={onViewChange}
          />
        </PropertiesMenu>
      </span>
    </div>
  );
}
