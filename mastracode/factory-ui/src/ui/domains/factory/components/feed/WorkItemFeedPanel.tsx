import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { queryKeys } from '../../../../../api/keys';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import type { WorkItem } from '../../services/workItems';
import { CommentComposer } from './CommentComposer';
import { CommentList } from './CommentList';
import type { CommentQuoteDraft } from './CommentQuote';

/** Thread-surface feed view; chrome mirrors WorkspaceChangesPanel. */
export function WorkItemFeedPanel({
  item,
  factoryProjectId,
  visible,
  onBack,
}: {
  item: WorkItem;
  factoryProjectId: string | undefined;
  visible: boolean;
  onBack: () => void;
}) {
  const auth = useFactoryAuth();
  const queryClient = useQueryClient();
  const [quote, setQuote] = useState<CommentQuoteDraft>();

  return (
    <aside
      className="flex min-h-0 min-w-0 grow flex-col"
      aria-label="Work item comments"
      data-testid="work-item-feed-panel"
    >
      <div className="flex min-h-10 items-center gap-1.5 px-1.5 py-1">
        <Button size="icon-xs" variant="ghost" onClick={onBack} aria-label="Back to workspace">
          <ArrowLeft />
        </Button>
        <MessageSquare className="text-icon3" size={14} />
        <Txt as="h2" variant="ui-sm" className="text-icon6">
          Comments
        </Txt>
        <Txt variant="ui-xs" className="text-icon3 ml-auto">
          {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
        </Txt>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Refresh comments"
          onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(item.id) })}
        >
          <RefreshCw />
        </Button>
      </div>
      <CommentList
        item={item}
        factoryProjectId={factoryProjectId}
        enabled={visible}
        currentUser={auth.data?.user}
        onQuote={setQuote}
        className="min-h-0 grow"
      />
      <div className="shrink-0">
        <CommentComposer
          workItemId={item.id}
          factoryProjectId={factoryProjectId}
          variant="thread"
          quote={quote}
          onDismissQuote={() => setQuote(undefined)}
        />
      </div>
    </aside>
  );
}
