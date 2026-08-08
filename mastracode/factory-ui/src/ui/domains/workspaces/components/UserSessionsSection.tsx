import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { removeCachedSession, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import { USER_SESSION_BRANCH_PREFIX, createUserSession, deleteUserSession } from '../services/github';
import type { FactoryUserSession } from '../services/github';
import { getUserSessionLabel } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';

/** Personal sessions whose isolated repository workspace is prepared lazily by AgentController. */
export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);
  const { pinnedSessions, setPinned } = usePinnedSessions();

  const repository = factoryQuery.data?.repositories[0];
  const sessionsEnabled = Boolean(repository);
  const sessionsQuery = useWorkspacesQuery(repository?.projectRepositoryId);
  const sessions = [...(sessionsQuery.data?.userSessions ?? [])].sort(
    (a, b) => Number(pinnedSessions.has(b.sessionId)) - Number(pinnedSessions.has(a.sessionId)),
  );

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

  const createSession = useMutation({
    mutationFn: async (rawName: string) => {
      if (!repository) throw new Error('Link a repository to this factory first');
      const slug = rawName.trim().toLowerCase().replace(/\s+/g, '-');
      if (!slug) throw new Error('Session name is required');
      const userSession = await createUserSession(
        baseUrl,
        repository.projectRepositoryId,
        `${USER_SESSION_BRANCH_PREFIX}${slug}`,
      );
      const chatSession = controllerSession(userSession.sessionId);
      await chatSession.create({ threadId: userSession.sessionId });
      await chatSession.renameThread(userSession.sessionId, rawName.trim());
      queryClient.setQueryData(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          userSession.sessionId,
          userSession.sessionId,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      return userSession;
    },
    onSuccess: session => {
      setCreating(false);
      setName('');
      invalidate();
      void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`);
    },
  });

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
    // A user session's thread id is its own id (created with that binding in
    // `createSession`), so navigate straight to it instead of blocking on a
    // session create round-trip first — the thread page brings the session
    // online on mount and shows a skeleton while its messages load.
    void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`);
  };

  const closeCreateDialog = () => {
    setCreating(false);
    setName('');
    createSession.reset();
  };
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) createSession.mutate(name);
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
          onClick={() => setCreating(true)}
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

            return (
              <SessionNavRow
                key={session.sessionId}
                name={name}
                title={session.branch}
                url={url}
                active={active}
                disabled={pending}
                pinned={pinnedSessions.has(session.sessionId)}
                onSelect={() => openSession(session)}
                onPinChange={pinned => setPinned(session.sessionId, pinned)}
                onDelete={() => setConfirmDelete(session)}
              />
            );
          })}
        </MainSidebar.NavList>
        {sessions.length === 0 && (
          <Txt as="p" variant="ui-xs" className="text-icon3 m-0 px-2 py-1">
            No sessions yet
          </Txt>
        )}
      </div>

      {creating && (
        <Dialog open onOpenChange={open => !open && closeCreateDialog()}>
          <DialogContent className="w-full max-w-sm" aria-label="New user session">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>New user session</DialogTitle>
            </DialogHeader>
            <form aria-label="Create user session" className="flex flex-col gap-4 px-5 pb-4" onSubmit={submitCreate}>
              <Input
                aria-label="Session name"
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="session-name"
                disabled={createSession.isPending}
              />
              {createSession.error && (
                <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
                  {createSession.error instanceof Error ? createSession.error.message : 'Failed to create session'}
                </Txt>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeCreateDialog} disabled={createSession.isPending}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createSession.isPending || !name.trim()}>
                  {createSession.isPending ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
