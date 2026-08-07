import { MastraClientError } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useMatch, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { removeCachedSession, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { UserSessionNotFoundError, deleteUserSession, getUserSession } from '../services/github';
import type { FactoryUserSession } from '../services/github';
import { getUserSessionLabel, getUserSessionTooltip } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';

export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const draftSessionId = useMatch('/factories/:factoryId/user/new/:draftSessionId')?.params.draftSessionId;
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
  const deleteSession = useMutation({
    mutationFn: async (session: FactoryUserSession) => {
      let storedSession: FactoryUserSession | null;
      try {
        storedSession = await getUserSession(baseUrl, session.sessionId);
      } catch (error) {
        if (!(error instanceof UserSessionNotFoundError)) throw error;
        storedSession = null;
      }
      // A thread only exists once the workspace materialized; asking the controller
      // for one before that would provision a sandbox just to delete nothing.
      if (storedSession?.materializedAt) {
        const chatSession = controllerSession(session.sessionId);
        try {
          await chatSession.deleteThread(session.sessionId);
        } catch (error) {
          if (!(error instanceof MastraClientError) || error.status !== 404) throw error;
        }
      }
      if (storedSession) await deleteUserSession(baseUrl, session.sessionId);
      return session;
    },
    onSuccess: session => {
      setConfirmDelete(null);
      removeCachedSession(queryClient, repository?.projectRepositoryId, session.sessionId);
      queryClient.removeQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      queryClient.removeQueries({
        queryKey: queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, session.sessionId, session.sessionId),
      });
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
          {draftSessionId && <SessionNavRow name="New session" url={location.pathname} active />}
          {sessions.map(session => {
            const name = getUserSessionLabel(session);
            const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
            const active = location.pathname === url;

            return (
              <SessionNavRow
                key={session.sessionId}
                name={name}
                title={getUserSessionTooltip(session)}
                url={url}
                active={active}
                disabled={pending}
                onSelect={() => void navigate(url)}
                onDelete={() => setConfirmDelete(session)}
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
        {!sessionsQuery.isError && sessions.length === 0 && !draftSessionId && (
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
