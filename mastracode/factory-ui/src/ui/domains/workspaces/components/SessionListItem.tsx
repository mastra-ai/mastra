import { useLocation, useNavigate } from 'react-router';

import { setSessionPinned } from '../hooks/usePinnedSessions';
import { useRegenerateSessionTitle } from '../hooks/useRegenerateSessionTitle';
import { STATUS_MARKER_BY_ACTIVITY } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import { SessionNavRow } from './SessionNavRow';

export function SessionListItem({
  factoryId,
  row,
  disabled,
  merged,
  onDelete,
}: {
  factoryId: string;
  row: SessionListRow;
  disabled: boolean;
  merged: boolean | undefined;
  onDelete: (row: SessionListRow) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { regenerate, regenerating } = useRegenerateSessionTitle(factoryId, row.session.sessionId);

  return (
    <SessionNavRow
      name={row.name}
      url={row.url}
      source={row.source}
      active={row.active}
      disabled={disabled}
      merged={merged}
      changeRequestProvider={row.pullRequest?.provider}
      status={STATUS_MARKER_BY_ACTIVITY[row.status]}
      pinned={row.pinned}
      preview={{
        kind: row.kind,
        owner: row.owner,
        itemLabel: row.itemLabel,
        itemTitle: row.itemTitle,
        branch: row.session.branch,
        baseBranch: row.session.baseBranch,
        updatedAt: row.updatedAt,
      }}
      onSelect={() => void navigate(row.openPath, row.origin === 'factory' ? { state: { from: location } } : undefined)}
      onPinChange={pinned => setSessionPinned(row.session.sessionId, pinned)}
      onDelete={row.ownedByViewer ? () => onDelete(row) : undefined}
      onRegenerateTitle={row.canRegenerateTitle ? regenerate : undefined}
      regeneratingTitle={regenerating}
    />
  );
}
