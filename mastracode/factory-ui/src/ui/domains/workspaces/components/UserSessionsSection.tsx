import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useWorkspaceAttentionState } from '../../../../hooks/useWorkspaceAttention';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { removeCachedSession, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import { deleteUserSession, regenerateSessionTitle } from '../services/user-sessions';
import type { FactoryUserSession } from '../services/user-sessions';
import { getSessionOwnerDetails, getUserSessionLabel } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';
import type { SessionRowStatus } from './SessionNavRow';

function userSessionStatus({
  session,
  running,
  attention,
}: {
  session: FactoryUserSession;
  running: boolean;
  attention: boolean;
}): SessionRowStatus | undefined {
  if (running) return 'working';
  if (!session.materializedAt) return 'initializing';
  if (attention) return 'ready';
  return undefined;
}

export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);
  const { pinnedSessions, setPinned } = usePinnedSessions();

  const repository = factoryQuery.data?.repositories[0];
  const sessionsEnabled = Boolean(repository);
  const sessionsQuery = useWorkspacesQuery(repository?.projectRepositoryId);
  const auth = useFactoryAuth();
  const viewerUserId = auth.data?.user?.userId;
  // Pinned rows stay on top; within each pin group the viewer's own sessions
  // sort before sessions started by other org members.
  const isOwn = (session: FactoryUserSession) => Boolean(viewerUserId) && session.userId === viewerUserId;
  const sessions = [...(sessionsQuery.data?.userSessions ?? [])].sort(
    (a, b) =>
      Number(pinnedSessions.has(b.sessionId)) - Number(pinnedSessions.has(a.sessionId)) ||
      Number(isOwn(b)) - Number(isOwn(a)),
  );
  const runningBySessionId = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: sessions.map(session => session.sessionId),
  });
  const { attentionByPath: attentionBySessionId, clearAttention } = useWorkspaceAttentionState({
    projectRepositoryId: repository?.projectRepositoryId,
    sessionKind: 'user',
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(repository?.projectRepositoryId) });
  };

  const deleteSession = useMutation({
    mutationFn: async (session: FactoryUserSession) => {
      // The thread is deliberately left behind: its transcript is the record of
      // what was worked on here, and a new session always gets a fresh id, so it
      // can never be re-attached to a later session.
      await deleteUserSession(baseUrl, session.sessionId);
      return session;
    },
    onSuccess: session => {
      setConfirmDelete(null);
      removeCachedSession(queryClient, repository?.projectRepositoryId, session.sessionId);
      queryClient.removeQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      invalidate();
      toast('Session deleted');
      if (location.pathname === `/factories/${factoryId}/user/threads/${session.sessionId}`) {
        void navigate(`/factories/${factoryId}`, { replace: true });
      }
    },
    onError: error => {
      setConfirmDelete(null);
      toast.error(error instanceof Error ? error.message : 'Failed to delete session');
    },
  });

  // Pending is per session: the mutation itself only remembers the last row asked for.
  const [regenerating, setRegenerating] = useState<ReadonlySet<string>>(new Set());
  const regenerateTitle = useMutation({
    mutationFn: (session: FactoryUserSession) => regenerateSessionTitle(baseUrl, session.sessionId),
    onMutate: session => setRegenerating(current => new Set(current).add(session.sessionId)),
    onSuccess: title => {
      invalidate();
      toast(`Renamed to “${title}”`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to regenerate title'),
    onSettled: (_title, _error, session) =>
      setRegenerating(current => {
        const next = new Set(current);
        next.delete(session.sessionId);
        return next;
      }),
  });

  if (!sessionsEnabled) return null;
  const pending = deleteSession.isPending;

  return (
    <section className="flex flex-col gap-2" aria-label="User sessions">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 tracking-wide uppercase">
          User Sessions
        </Txt>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New user session"
          onClick={() => void navigate(`/factories/${factoryId}/user/new/${crypto.randomUUID()}`)}
          disabled={pending}
        >
          <Plus size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <MainSidebar.NavList>
          {sessions.map(session => {
            const name = getUserSessionLabel(session);
            const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
            const active = location.pathname === url;

            const status = userSessionStatus({
              session,
              running: runningBySessionId[session.sessionId] === true,
              attention: attentionBySessionId[session.sessionId] === true,
            });
            return (
              <SessionNavRow
                key={session.sessionId}
                name={name}
                preview={{
                  kind: 'User session',
                  owner: getSessionOwnerDetails(session, auth.data?.user),
                  branch: session.branch,
                  baseBranch: session.baseBranch,
                  updatedAt: session.updatedAt,
                }}
                url={url}
                active={active}
                disabled={pending}
                status={status}
                pinned={pinnedSessions.has(session.sessionId)}
                onSelect={() => {
                  clearAttention(session.sessionId);
                  void navigate(url);
                }}
                onPinChange={pinned => setPinned(session.sessionId, pinned)}
                // The DELETE route is owner-only and 404s for non-owners, which
                // deleteUserSession treats as an idempotent success; offering
                // delete on a known non-owned row would fake-succeed and the
                // row would reappear. Unknown viewer (auth disabled) keeps it.
                onDelete={viewerUserId && !isOwn(session) ? undefined : () => setConfirmDelete(session)}
                onRegenerateTitle={viewerUserId && !isOwn(session) ? undefined : () => regenerateTitle.mutate(session)}
                regeneratingTitle={regenerating.has(session.sessionId)}
              />
            );
          })}
        </MainSidebar.NavList>
        {sessionsQuery.isError && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Txt as="p" variant="ui-xs" className="text-error m-0">
              Couldn’t load sessions
            </Txt>
            <Button variant="ghost" size="xs" onClick={() => void sessionsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {sessionsQuery.isSuccess && sessions.length === 0 && (
          <Txt as="p" variant="ui-xs" className="text-icon3 m-0 px-2 py-1">
            No sessions yet
          </Txt>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={open => !open && setConfirmDelete(null)}>
          <DialogContent className="w-full max-w-sm" aria-label="Delete user session">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>Delete session?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-4">
              <Txt as="p" variant="ui-sm" className="text-icon4 m-0">
                This deletes the <span className="text-icon6">{getUserSessionLabel(confirmDelete)}</span> session and
                its checkout with any uncommitted changes. This can’t be undone. Its conversation is kept.
              </Txt>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleteSession.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={() => deleteSession.mutate(confirmDelete)}
                  disabled={deleteSession.isPending}
                >
                  {deleteSession.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
