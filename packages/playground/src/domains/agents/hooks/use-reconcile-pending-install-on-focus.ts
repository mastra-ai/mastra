import { useReconcileChannelInstallation } from '@mastra/react/hooks/agents';
import { useEffect } from 'react';

/**
 * While the agent has a pending installation — a connect flow left Studio and
 * may complete out-of-band (e.g. Discord's bot invite has no redirect back) —
 * ask the server to reconcile it whenever the window regains focus: returning
 * from the invite tab is the moment the flow is most likely to have finished.
 *
 * Reconciliation is an explicit write (it can activate the install), which is
 * why this lives here instead of an SDK-wide refetch-on-focus: only the
 * surface that knows a connect is in flight should trigger it. A reconcile
 * invalidates the installations query on completion, so the UI flips to
 * Connected without a manual refresh. No-op while no pending installation
 * exists.
 */
export function useReconcilePendingInstallOnFocus({
  platform,
  agentId,
  hasPendingInstall,
}: {
  platform: string;
  agentId: string;
  hasPendingInstall: boolean;
}) {
  const { mutate: reconcile } = useReconcileChannelInstallation({ platform });

  useEffect(() => {
    if (!hasPendingInstall) return;
    const onFocus = () => reconcile(agentId);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [hasPendingInstall, agentId, reconcile]);
}
