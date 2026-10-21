import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useSessionVisibility } from '../hooks/useSessionVisibility';
import type { FactoryUserSession } from '../services/user-sessions';
import { SLACK_SESSION_BRANCH_PREFIX } from '../services/user-sessions';
import { SessionSharingPopover } from './SessionSharingPopover';

export function UserSessionSharing({ factoryId, session }: { factoryId: string; session: FactoryUserSession }) {
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const { changeVisibility, changing } = useSessionVisibility(factoryId, session.sessionId);
  const canShare = viewerUserId === session.userId && !session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX);

  if (session.visibility !== 'private') return null;

  return (
    <SessionSharingPopover
      name={session.title ?? 'New session'}
      placement="header"
      onShare={canShare ? () => changeVisibility('org') : undefined}
      sharing={changing}
    />
  );
}
