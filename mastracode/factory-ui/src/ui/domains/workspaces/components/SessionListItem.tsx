import { toast } from '@mastra/playground-ui/components/Toaster';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { useLocation } from 'react-router';

import { setSessionPinned } from '../hooks/usePinnedSessions';
import { useRegenerateSessionTitle } from '../hooks/useRegenerateSessionTitle';
import { useSessionVisibility } from '../hooks/useSessionVisibility';
import { STATUS_MARKER_BY_ACTIVITY } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import type { UserSessionVisibility } from '../services/user-sessions';
import { SessionNavRow } from './SessionNavRow';

export function SessionListItem({
  factoryId,
  row,
  level = 0,
  sideSessions,
  holdsOpenSideSession = false,
  renderSideSession,
  disabled,
  merged,
  onDelete,
}: {
  factoryId: string;
  row: SessionListRow;
  /** Nesting depth: 0 for a top-level row, 1 for a side session of one, and so on. */
  level?: number;
  /** Side sessions this session started, listed beneath it while expanded. */
  sideSessions?: readonly SessionListRow[];
  /** Opens the side sessions while one of them is the open session, until the viewer toggles them. */
  holdsOpenSideSession?: boolean;
  renderSideSession?: (row: SessionListRow) => ReactNode;
  disabled: boolean;
  merged: boolean | undefined;
  onDelete: (row: SessionListRow) => void;
}) {
  const location = useLocation();
  const { regenerate, regenerating } = useRegenerateSessionTitle(factoryId, row.session.sessionId);
  const { changeVisibility, changing } = useSessionVisibility(factoryId, row.session.sessionId);
  const ownUserSession = row.origin === 'user' && row.ownedByViewer;
  const [sideSessionsToggled, setSideSessionsToggled] = useState<boolean>();
  const sideSessionsExpanded = sideSessionsToggled ?? holdsOpenSideSession;

  async function handleVisibilityChange(visibility: UserSessionVisibility) {
    try {
      const session = await changeVisibility(visibility);
      toast(session.visibility === 'org' ? 'Session shared with your organization' : 'Session is now private');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change session visibility');
    }
  }

  return (
    <>
      <SessionNavRow
        name={row.name}
        url={row.openPath}
        externalLinks={row.externalLinks}
        from={row.origin === 'factory' ? location : undefined}
        source={row.source}
        active={row.active}
        disabled={disabled}
        merged={merged}
        changeRequestProvider={row.pullRequest?.provider}
        status={STATUS_MARKER_BY_ACTIVITY[row.status]}
        pinned={row.pinned}
        preview={{ factoryId, session: row.session, owner: row.owner, item: row.item, threadId: row.threadId }}
        onPinChange={pinned => setSessionPinned(row.session.sessionId, pinned)}
        onDelete={row.ownedByViewer ? () => onDelete(row) : undefined}
        onRegenerateTitle={row.canRegenerateTitle ? regenerate : undefined}
        regeneratingTitle={regenerating}
        visibility={row.origin === 'user' ? row.session.visibility : undefined}
        // Slack threads keep the visibility they were created with; the server refuses a change.
        onVisibilityChange={
          ownUserSession && !row.session.branch.startsWith('slack/') ? handleVisibilityChange : undefined
        }
        changingVisibility={changing}
        level={level}
        sideSessions={
          sideSessions?.length
            ? {
                count: sideSessions.length,
                expanded: sideSessionsExpanded,
                onExpandedChange: setSideSessionsToggled,
              }
            : undefined
        }
      />
      {sideSessionsExpanded && renderSideSession
        ? sideSessions?.map(sideSession => (
            <Fragment key={sideSession.session.sessionId}>{renderSideSession(sideSession)}</Fragment>
          ))
        : null}
    </>
  );
}
