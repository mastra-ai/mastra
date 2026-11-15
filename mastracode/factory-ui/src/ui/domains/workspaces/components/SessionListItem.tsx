import { toast } from '@mastra/playground-ui/components/Toaster';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { useAnswerParkedApproval } from '../hooks/useAnswerParkedApproval';
import { updatePinnedSessions } from '../hooks/usePinnedSessions';
import { useRegenerateSessionTitle } from '../hooks/useRegenerateSessionTitle';
import { useSessionVisibility } from '../hooks/useSessionVisibility';
import { STATUS_MARKER_BY_ACTIVITY, pinnedSessionsAfter } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import type { UserSessionVisibility } from '../services/user-sessions';
import { SessionNavRow } from './SessionNavRow';

export function SessionListItem({
  factoryId,
  row,
  disabled,
  level,
  compact,
  onDelete,
  subItems,
}: {
  factoryId: string;
  row: SessionListRow;
  /** 1 for a card's child session, listed under the card's row. */
  level?: number;
  /** Single-line row; otherwise a second line shows its time and its change request. */
  compact: boolean;
  disabled: boolean;
  onDelete: (row: SessionListRow) => void;
  /** The card's child sessions, nested under its row. */
  subItems?: ReactNode;
}) {
  const location = useLocation();
  const { regenerate, regenerating } = useRegenerateSessionTitle(factoryId, row.session.sessionId);
  const { changeVisibility, changing } = useSessionVisibility(factoryId, row.session.sessionId);
  const { answer, answering } = useAnswerParkedApproval(factoryId, row.waitingSessionId);
  const ownUserSession = row.origin === 'user' && row.ownedByViewer;

  async function handleVisibilityChange(visibility: UserSessionVisibility) {
    try {
      const session = await changeVisibility(visibility);
      toast(session.visibility === 'org' ? 'Session shared with your organization' : 'Session is now private');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change session visibility');
    }
  }

  return (
    <SessionNavRow
      name={row.name}
      label={row.phaseLabel}
      runByFactory={row.runByFactory}
      level={level}
      url={row.openPath}
      externalLinks={row.externalLinks}
      from={row.origin === 'factory' ? location : undefined}
      source={row.source}
      active={row.active}
      disabled={disabled}
      status={STATUS_MARKER_BY_ACTIVITY[row.status]}
      pinned={row.pinned}
      preview={{
        factoryId,
        session: row.session,
        owner: row.owner,
        item: row.item,
        board: row.board,
        threadId: row.threadId,
        repository: row.repository,
        subscriptions: row.subscriptions,
      }}
      onPinChange={pin => updatePinnedSessions(pinned => pinnedSessionsAfter(pinned, row, pin))}
      onDelete={row.ownedByViewer ? () => onDelete(row) : undefined}
      onRegenerateTitle={row.canRegenerateTitle ? regenerate : undefined}
      regeneratingTitle={regenerating}
      onAnswerApproval={answer}
      answeringApproval={answering}
      visibility={row.origin === 'user' ? row.session.visibility : undefined}
      // Slack threads keep the visibility they were created with; the server refuses a change.
      onVisibilityChange={
        ownUserSession && !row.session.branch.startsWith('slack/') ? handleVisibilityChange : undefined
      }
      changingVisibility={changing}
      pullRequest={row.pullRequest}
      pullRequestStatus={row.pullRequestStatus}
      repository={row.repository}
      time={row.time}
      compact={compact}
      subItems={subItems}
    />
  );
}
