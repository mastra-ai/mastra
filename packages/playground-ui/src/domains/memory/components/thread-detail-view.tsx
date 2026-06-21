import { ArrowLeftIcon, BrainIcon } from 'lucide-react';
import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { cn } from '../../../lib/utils';
import type { MemoryMessage, OMHistoryRecord } from '../types';
import { MemoryMessageList } from './memory-message-list';
import { ObservationDetailView } from './observation-detail-view';

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

  const BackWrapper = backHref && LinkComponent ? LinkComponent : 'button';
  const backProps = backHref && LinkComponent ? { href: backHref } : { type: 'button' as const, onClick: onBack };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--mastra-border-1)] px-4 py-2.5">
        {(onBack || backHref) && (
          <BackWrapper {...backProps} className="flex items-center gap-1.5 text-xs text-[var(--mastra-el-3)] hover:text-[var(--mastra-el-6)] transition-colors">
            <ArrowLeftIcon className="size-3" />
            <span>Threads</span>
          </BackWrapper>
        )}
        <div className="h-4 w-px bg-[var(--mastra-border-1)]" />
        {isThreadLoading ? (
          <div className="h-4 w-48 animate-pulse rounded bg-[var(--mastra-bg-3)]" />
        ) : (
          <>
            <h1 className="truncate text-sm font-medium text-[var(--mastra-el-6)]">
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

      <div className="flex min-h-0 flex-1">
        <div className={cn('flex min-w-0 flex-col overflow-y-auto', showOM && hasOM ? 'w-[60%]' : 'flex-1')}>
          <MemoryMessageList messages={messages} isLoading={isMessagesLoading} />
        </div>

        {hasOM && showOM && (
          <div className="flex w-[40%] min-w-[280px] flex-col overflow-hidden border-l border-[var(--mastra-border-1)]">
            <div className="shrink-0 border-b border-[var(--mastra-border-1)] px-4 py-2">
              <div className="flex items-center gap-2">
                <BrainIcon className="size-3.5 text-[var(--mastra-el-3)]" />
                <h2 className="text-xs font-medium text-[var(--mastra-el-6)]">Observational Memory</h2>
              </div>
            </div>
            <ObservationDetailView
              records={omRecords}
              selectedRecordId={selectedOMRecordId}
              onSelectRecord={setSelectedOMRecordId}
              isLoading={isOMLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
