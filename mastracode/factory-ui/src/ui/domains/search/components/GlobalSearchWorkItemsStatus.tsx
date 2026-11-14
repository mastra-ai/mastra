import { Notice } from '@mastra/playground-ui/components/Notice';
import { RefreshCw } from 'lucide-react';

// Session titles come from board cards, so a board failure downgrades them to branch names.
export function GlobalSearchWorkItemsStatus({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) return null;

  return (
    <div className="px-3 py-2">
      <Notice
        variant="warning"
        action={
          <Notice.Button onClick={onRetry}>
            Retry <RefreshCw />
          </Notice.Button>
        }
      >
        Board cards could not be loaded. Sessions still show, titled by branch.
      </Notice>
    </div>
  );
}
