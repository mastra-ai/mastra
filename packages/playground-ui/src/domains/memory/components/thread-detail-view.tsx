import { ArrowLeftIcon, BrainIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';

import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import { extractOmMarkers } from '../lib/extract-markers';
import { getLatestThreadContextWindowState } from '../lib/thread-context-window-state';
import { timestampsToTDomain } from '../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../types';
import { FlameGraph } from './flame-graph';
import { MemoryMessageList } from './memory-message-list';
import { ObservationDetailView } from './observation-detail-view';
import { ThreadContextProgress } from './thread-context-progress';

export interface ThreadDetailViewProps {
  thread: { id: string; title?: string; resourceId?: string } | undefined;
  messages: MemoryMessage[];
  omRecords: OMHistoryRecord[];
  isThreadLoading: boolean;
  isMessagesLoading: boolean;
  isOMLoading: boolean;
  onBack?: () => void;
  backHref?: string;
  LinkComponent?: ElementType;
  headerSlot?: ReactNode;
}

export function ThreadDetailView({
  thread,
  messages,
  omRecords,
  isThreadLoading,
  isMessagesLoading,
  isOMLoading,
  onBack,
  backHref,
  LinkComponent,
  headerSlot,
}: ThreadDetailViewProps) {
  const [selectedOMRecordId, setSelectedOMRecordId] = useState<string | null>(null);
  const [showOM, setShowOM] = useState(true);
  const hasOM = omRecords.length > 0 || isOMLoading;

  const markers = useMemo(() => extractOmMarkers(messages), [messages]);
  const tDomain = useMemo(() => {
    if (messages.length === 0) return { tMin: 0, tMax: 1 };
    return timestampsToTDomain(messages.map(m => new Date(m.createdAt).toISOString()));
  }, [messages]);
  const currentWindowState = useMemo(
    () => getLatestThreadContextWindowState({ markers, omRecords }),
    [markers, omRecords],
  );

  const BackWrapper = backHref && LinkComponent ? LinkComponent : 'button';
  const backProps = backHref && LinkComponent ? { href: backHref } : { type: 'button' as const, onClick: onBack };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border1 px-4 py-2.5">
        {(onBack || backHref) && (
          <BackWrapper
            {...backProps}
            className="flex items-center gap-1.5 text-xs text-icon3 hover:text-neutral6 transition-colors"
          >
            <ArrowLeftIcon className="size-3" />
            <span>Threads</span>
          </BackWrapper>
        )}
        <div className="h-4 w-px bg-border1" />
        {isThreadLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : (
          <>
            <h1 className="truncate text-sm font-medium text-neutral6">
              {thread?.title || thread?.id || '—'}
            </h1>
            {thread?.resourceId && (
              <Badge variant="default" size="xs" className="ml-1 font-mono">
                {thread.resourceId}
              </Badge>
            )}
          </>
        )}
        <div className="flex-1" />
        {hasOM && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setShowOM(!showOM)}>
            <BrainIcon className="size-3" />
            {showOM ? 'Hide' : 'Show'} Memory
          </Button>
        )}
        {headerSlot}
      </div>

      {/* Split content: Messages | Observation detail */}
      <div
        className={cn(
          'flex min-h-0 flex-1 divide-x divide-border1',
          showOM && hasOM ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : '',
        )}
      >
        {/* Left: Messages */}
        <div className="min-w-0 flex flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border1 px-4 py-2">
            <p className="text-sm font-normal text-neutral6">
              Messages{!isMessagesLoading && messages.length > 0 ? ` (${messages.length})` : ''}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MemoryMessageList messages={messages} isLoading={isMessagesLoading} />
          </div>
        </div>

        {/* Right: Observation memory + flame graph */}
        {hasOM && showOM && (
          <div className="min-w-0 grid grid-rows-[1fr_auto] overflow-hidden">
            <div className="min-h-0 flex flex-col overflow-hidden">
              <ObservationDetailView
                records={omRecords}
                selectedRecordId={selectedOMRecordId}
                onSelectRecord={setSelectedOMRecordId}
                isLoading={isOMLoading}
              />
            </div>
            <div className="border-t border-border1">
              <ThreadContextProgress
                messageTokens={currentWindowState?.messageTokens}
                messageThreshold={currentWindowState?.messageThreshold}
                memoryTokens={currentWindowState?.memoryTokens}
                memoryThreshold={currentWindowState?.memoryThreshold}
              />
              <FlameGraph omRecords={omRecords} markers={markers} messages={messages} tDomain={tDomain} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
