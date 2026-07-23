import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GitBranch, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../../shared/api/keys';
import { useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { useWorkspacesQuery } from '../../../../../shared/hooks/useWorkspaces';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { USER_SESSION_BRANCH_PREFIX } from '../services/github';
import type { FactoryUserSession } from '../services/github';
import { createUserSession, deleteUserSession } from '../services/github';

function sessionLabel(session: FactoryUserSession): string {
  return session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)
    ? session.branch.slice(USER_SESSION_BRANCH_PREFIX.length)
    : session.branch;
}

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

  const openSession = async (session: FactoryUserSession) => {
    try {
      await controllerSession(session.sessionId).create({ threadId: session.sessionId });
      void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open session');
    }
  };

  const resetCreate = () => {
    setCreating(false);
    setName('');
  };
  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim()) createSession.mutate(name);
  };
  const onCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') resetCreate();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (name.trim()) createSession.mutate(name);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label="User sessions">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          User Sessions
        </Txt>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New user session"
          onClick={() => setCreating(true)}
          disabled={creating || pending}
        >
          <Plus size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <MainSidebar.NavList>
          {sessions.map(session => {
            const name = sessionLabel(session);
            const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
            const active = location.pathname === url;

            return (
              <MainSidebar.NavLink
                key={session.sessionId}
                link={{ name, url }}
                isActive={active}
                className="group/session"
                render={
                  <button
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    aria-label={name}
                    disabled={pending}
                    onClick={() => void openSession(session)}
                    title={session.branch}
                  >
                    <GitBranch />
                    <MainSidebar.NavLabel>{name}</MainSidebar.NavLabel>
                  </button>
                }
                action={
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Session actions for ${name}`}
                          disabled={pending}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100 data-[popup-open]:opacity-100"
                        >
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content align="end" className="min-w-28">
                      <DropdownMenu.Item variant="destructive" onClick={() => setConfirmDelete(session)}>
                        <Trash2 />
                        Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                }
              />
            );
          })}
        </MainSidebar.NavList>
        {sessions.length === 0 && !creating && (
          <Txt as="p" variant="ui-xs" className="m-0 px-2 py-1 text-icon3">
            No sessions yet
          </Txt>
        )}

        {creating && (
          <form aria-label="Create user session" className="flex flex-col gap-1" onSubmit={submitCreate}>
            <Input
              aria-label="Session name"
              autoFocus
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={onCreateKeyDown}
              placeholder="session-name"
              disabled={createSession.isPending}
              className="h-8 text-xs"
            />
            {createSession.error && (
              <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
                {createSession.error instanceof Error ? createSession.error.message : 'Failed to create session'}
              </Txt>
            )}
          </form>
        )}
      </div>

      {confirmDelete && (
        <Dialog open onOpenChange={open => !open && setConfirmDelete(null)}>
          <DialogContent className="w-full max-w-sm" aria-label="Delete user session">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>Delete session?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-4">
              <Txt as="p" variant="ui-sm" className="m-0 text-icon4">
                This deletes the <span className="text-icon6">{sessionLabel(confirmDelete)}</span> session, its checkout
                with any uncommitted changes, and its conversation. This can’t be undone.
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
