import { toast } from '@mastra/playground-ui/components/Toaster';

import { useFactoryAttentionReceiptAction } from '../../../../hooks/useFactoryAttention';
import { useFactoryDecisionAction } from '../../../../hooks/useFactoryDecisions';
import type { FactoryAttentionItem } from '../services/attention';

function isSameItem(a: FactoryAttentionItem | undefined, b: FactoryAttentionItem): boolean {
  return a?.key === b.key;
}

function notifyFailure(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

/** Row wiring shared by the sidebar popover and the attention page. */
export function useAttentionItemActions(factoryId: string | undefined) {
  const retryDecision = useFactoryDecisionAction(factoryId, 'retry');
  const approveDecision = useFactoryDecisionAction(factoryId, 'approve');
  const dismissDecision = useFactoryDecisionAction(factoryId, 'dismiss');
  const readItem = useFactoryAttentionReceiptAction(factoryId, 'read');
  const archiveItem = useFactoryAttentionReceiptAction(factoryId, 'archive');
  const restoreItem = useFactoryAttentionReceiptAction(factoryId, 'restore');

  return (item: FactoryAttentionItem) => ({
    item,
    retrying:
      item.kind === 'automation-failed' && retryDecision.isPending && retryDecision.variables === item.decisionId,
    settling:
      item.kind === 'automation-proposed' &&
      ((approveDecision.isPending && approveDecision.variables === item.decisionId) ||
        (dismissDecision.isPending && dismissDecision.variables === item.decisionId)),
    updatingReceipt:
      (readItem.isPending && isSameItem(readItem.variables, item)) ||
      (archiveItem.isPending && isSameItem(archiveItem.variables, item)) ||
      (restoreItem.isPending && isSameItem(restoreItem.variables, item)),
    onRetry:
      item.kind === 'automation-failed' && item.canRetry
        ? () => retryDecision.mutate(item.decisionId, { onError: notifyFailure('Unable to retry automation') })
        : undefined,
    onApprove:
      item.kind === 'automation-proposed'
        ? () => approveDecision.mutate(item.decisionId, { onError: notifyFailure('Unable to start the run') })
        : undefined,
    onDismiss:
      item.kind === 'automation-proposed'
        ? () => dismissDecision.mutate(item.decisionId, { onError: notifyFailure('Unable to dismiss the run') })
        : undefined,
    onRead: () => readItem.mutate(item, { onError: notifyFailure('Unable to mark attention item as read') }),
    onArchive: () => archiveItem.mutate(item, { onError: notifyFailure('Unable to archive attention item') }),
    onRestore: () => restoreItem.mutate(item, { onError: notifyFailure('Unable to restore attention item') }),
  });
}
