import { Notice } from '@mastra/playground-ui/components/Notice';
import { RefreshCw } from 'lucide-react';

// Session titles come from board cards, so only a board failure downgrades them to branch names
function failureMessage(boardFailed: boolean, intakeFailed: boolean): string {
  if (!boardFailed) return 'GitHub intake could not be loaded.';
  if (!intakeFailed) return 'Board cards could not be loaded. Sessions still show, titled by branch.';
  return 'Board cards and GitHub intake could not be loaded. Sessions still show, titled by branch.';
}

export function GlobalSearchWorkItemsStatus({
  boardFailed,
  intakeFailed,
  onRetry,
}: {
  boardFailed: boolean;
  intakeFailed: boolean;
  onRetry: () => void;
}) {
  if (!boardFailed && !intakeFailed) return null;

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
        {failureMessage(boardFailed, intakeFailed)}
      </Notice>
    </div>
  );
}
