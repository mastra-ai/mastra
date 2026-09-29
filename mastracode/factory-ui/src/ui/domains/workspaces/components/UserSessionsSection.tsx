import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SidebarSectionHeading } from '../../../SidebarSectionHeading';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { removeCachedSession, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import { deleteUserSession, regenerateSessionTitle } from '../services/user-sessions';
import type { FactoryUserSession } from '../services/user-sessions';
import {
  activeUserSessionFilterCount,
  defaultUserSessionFilters,
  filterUserSessions,
} from '../services/sessionFilters';
import type { UserSessionFiltersState } from '../services/sessionFilters';
import { getSessionOwnerDetails, getUserSessionLabel } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';
import { sessionRowStatus } from '../services/sessionStatus';
import { UserSessionFilters } from './UserSessionFilters';

export function UserSessionsSection() {
  const { baseUrl } = useApiConfig();
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);
  const [filterChanges, setFilterChanges] = useState<Partial<UserSessionFiltersState>>({});
  const { pinnedSessions, setPinned } = usePinnedSessions();

  const repository = factoryQuery.data?.repositories[0];
  const sessionsEnabled = Boolean(repository);
  const sessionsQuery = useWorkspacesQuery(repository?.projectRepositoryId);
  const auth = useFactoryAuth();
  const viewerUserId = auth.data?.user?.userId;
  const defaultFilters = defaultUserSessionFilters(viewerUserId);
  const filters: UserSessionFiltersState = { ...defaultFilters, ...filterChanges };
  const isOwn = (session: FactoryUserSession) => Boolean(viewerUserId) && session.userId === viewerUserId;
  const allSessions = [...(sessionsQuery.data?.userSessions ?? [])].sort(
    (a, b) =>
      Number(pinnedSessions.has(b.sessionId)) - Number(pinnedSessions.has(a.sessionId)) ||
      Number(isOwn(b)) - Number(isOwn(a)),
  );
  const runningBySessionId = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: allSessions.map(session => session.sessionId),
  });
  const candidates = allSessions.map(session => ({
    session,
    ownerName: getSessionOwnerDetails(session, auth.data?.user).name,
    status: !session.materializedAt
      ? ('initializing' as const)
      : runningBySessionId[session.sessionId] === true
        ? ('working' as const)
        : ('idle' as const),
  }));
  const sessions = filterUserSessions(candidates, filters, viewerUserId).map(candidate => candidate.session);
  const ownersById = new Map<string, string>();
  for (const candidate of candidates) ownersById.set(candidate.session.userId, candidate.ownerName);
  const owners = [...ownersById]
    .map(([userId, name]) => ({ userId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(repository?.projectRepositoryId) });
  };

  const deleteSession = useMutation({
    mutationFn: async (session: FactoryUserSession) => {
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
    <section className="flex flex-col gap-1" aria-label="User sessions">
      <SidebarSectionHeading
        icon={<MessageSquare />}
        action={
          <div className="flex items-center gap-0.5">
            <UserSessionFilters
              filters={filters}
              owners={owners}
              viewerUserId={viewerUserId}
              onChange={changes => setFilterChanges(current => ({ ...current, ...changes }))}
              onReset={() => setFilterChanges({})}
            />
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
        }
      >
        User Sessions
      </SidebarSectionHeading>

      <div className="flex flex-col gap-1">
        <MainSidebar.NavList>
          {sessions.map(session => {
            const name = getUserSessionLabel(session);
            const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
            const active = location.pathname === url;

            const status = sessionRowStatus({
              running: runningBySessionId[session.sessionId] === true,
              initializing: !session.materializedAt,
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
                onSelect={() => void navigate(url)}
                onPinChange={pinned => setPinned(session.sessionId, pinned)}
                onDelete={viewerUserId && !isOwn(session) ? undefined : () => setConfirmDelete(session)}
                onRegenerateTitle={viewerUserId && !isOwn(session) ? undefined : () => regenerateTitle.mutate(session)}
                regeneratingTitle={regenerating.has(session.sessionId)}
              />
            );
          })}
        </MainSidebar.NavList>
        {sessionsQuery.isError && (
          <div className="flex items-center gap-2 px-2 py-1">
            <Txt as="p" variant="meta" className="text-destructive-indicator m-0">
              Couldn’t load sessions
            </Txt>
            <Button variant="ghost" size="sm" onClick={() => void sessionsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {sessionsQuery.isSuccess && sessions.length === 0 && (
          <Txt as="p" variant="meta" tone="muted" role="status" className="m-0 px-2 py-1">
            {allSessions.length === 0
              ? 'No sessions yet'
              : activeUserSessionFilterCount(filters, defaultFilters) === 0 && viewerUserId
                ? 'No sessions of your own.'
                : 'No sessions match these filters'}
          </Txt>
        )}
      </div>

      {confirmDelete && (
        <Dialog
          open
          onOpenChange={open => !open && setConfirmDelete(null)}
          intent="destructive"
          pending={deleteSession.isPending}
        >
          <DialogContent size="sm" aria-label="Delete user session">
            <DialogHeader>
              <DialogTitle>Delete session?</DialogTitle>
              <DialogDescription>
                This deletes the <span className="text-foreground">{getUserSessionLabel(confirmDelete)}</span> session
                and its checkout with any uncommitted changes. This can’t be undone. Its conversation is kept.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction onConfirm={() => deleteSession.mutate(confirmDelete)}>
                {deleteSession.isPending ? 'Deleting…' : 'Delete'}
              </DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
