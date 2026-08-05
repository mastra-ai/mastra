import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { addCachedSession, removeCachedSession, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { USER_SESSION_BRANCH_PREFIX, createUserSession, deleteUserSession } from '../services/github';
import type { FactoryUserSession } from '../services/github';
import { getUserSessionLabel, nextUserSessionName } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';

/** Personal sessions whose isolated repository workspace is prepared lazily by AgentController. */
export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);

  const repository = factoryQuery.data?.repositories[0];
  const sessionsEnabled = Boolean(repository);
  const sessionsQuery = useWorkspacesQuery(repository?.projectRepositoryId);
  const sessions = sessionsQuery.data?.userSessions ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(repository?.projectRepositoryId) });
  };

  const controllerSession = (sessionId: string) => {
    const { session } = createAgentControllerClient({
      agentControllerId: AGENT_CONTROLLER_ID,
      resourceId: sessionId,
      baseUrl,
    });
    return requireAgentControllerSession(session);
  };

  // Row only: bringing the controller session online provisions a sandbox and
  // clones the repo — minutes the thread page already spends on mount.
  const createSession = useMutation({
    mutationFn: async (name: string) => {
      if (!repository) throw new Error('Link a repository to this factory first');
      return createUserSession(baseUrl, repository.projectRepositoryId, `${USER_SESSION_BRANCH_PREFIX}${name}`);
    },
    onSuccess: session => {
      // Seed what the thread page reads on mount — this response already
      // carries it, so it renders the session instead of a spinner.
      queryClient.setQueryData(queryKeys.userSession(session.sessionId), session);
      addCachedSession(queryClient, repository?.projectRepositoryId, session);
      queryClient.setQueryData(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          session.sessionId,
          session.sessionId,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      invalidate();
      void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to create session'),
  });

  const deleteSession = useMutation({
    mutationFn: async (session: FactoryUserSession) => {
      const chatSession = controllerSession(session.sessionId);
      try {
        await chatSession.deleteThread(session.sessionId);
      } finally {
        await deleteUserSession(baseUrl, session.sessionId);
      }
      return session;
    },
    onSuccess: session => {
      setConfirmDelete(null);
      removeCachedSession(queryClient, repository?.projectRepositoryId, session.sessionId);
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

  if (!sessionsEnabled) return null;
  const pending = createSession.isPending || deleteSession.isPending;

  const openSession = (session: FactoryUserSession) => {
    // A user session's thread id is its own id, and the thread page binds the
    // controller session to it on mount — nothing to await here.
    void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`);
  };

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
          onClick={() => createSession.mutate(nextUserSessionName(sessions))}
          // Naming off an unloaded list repeats a name in use, and create is
          // idempotent per branch — that reopens the old session.
          disabled={pending || !sessionsQuery.isSuccess}
        >
          {createSession.isPending ? <Spinner size="sm" /> : <Plus size={15} />}
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <MainSidebar.NavList>
          {sessions.map(session => {
            const name = getUserSessionLabel(session);
            const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
            const active = location.pathname === url;

            return (
              <SessionNavRow
                key={session.sessionId}
                name={name}
                title={session.branch}
                url={url}
                active={active}
                disabled={pending}
                onSelect={() => openSession(session)}
                onDelete={() => setConfirmDelete(session)}
              />
            );
          })}
        </MainSidebar.NavList>
        {sessionsQuery.isError ? (
          // The Plus button is gated on this list, so a failed load has to say
          // why it is dead and offer the way out.
          <div className="flex items-center gap-2 px-2 py-1">
            <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
              Couldn’t load sessions
            </Txt>
            <Button variant="ghost" size="xs" onClick={() => void sessionsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          sessions.length === 0 && (
            <Txt as="p" variant="ui-xs" className="text-icon3 m-0 px-2 py-1">
              No sessions yet
            </Txt>
          )
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
                This deletes the <span className="text-icon6">{getUserSessionLabel(confirmDelete)}</span> session, its
                checkout with any uncommitted changes, and its conversation. This can’t be undone.
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
