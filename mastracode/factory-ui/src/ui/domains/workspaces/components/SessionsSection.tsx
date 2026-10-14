import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowUpDown, CircleDashed, Clock, MessagesSquare, Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useWorkspacePullRequestMerges } from '../../../../hooks/useWorkspacePullRequestMerges';
import { useDeleteUserSessionMutation, useDeleteWorkspaceMutation } from '../../../../hooks/useWorkspaces';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import { useRegenerateSessionTitle } from '../hooks/useRegenerateSessionTitle';
import { useSessionListRows } from '../hooks/useSessionListRows';
import { useSessionListView } from '../hooks/useSessionListView';
import {
  SESSION_STATUS_OPTIONS,
  SESSION_UPDATED_OPTIONS,
  activeSessionFilterCount,
  defaultSessionFilters,
  filterSessionRows,
  sessionOwnerOptions,
} from '../services/sessionFilters';
import type { SessionFiltersState } from '../services/sessionFilters';
import { DEFAULT_SESSION_GROUP_BY, groupSessionRows, sessionGroupOrder } from '../services/sessionGroups';
import type { SessionGroupContext } from '../services/sessionGroups';
import type { SessionListRow } from '../services/sessionRows';
import { DEFAULT_SESSION_SORT, SESSION_SORT_OPTIONS, compareSessionRows } from '../services/sessionSort';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { SessionGroupList, collapsedRowsKeepingActive } from './SessionGroupList';
import { SessionGroupMenu } from './SessionGroupMenu';
import { SessionListProperties } from './SessionListProperties';

export function SessionsSection() {
  const { factoryId, sessionId: routeSessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, resourceId, sessionEnabled } = useChatSessionContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { rows, hasRepositories, loaded, loadFailed, retry } = useSessionListRows(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const { view, updateView, resetView } = useSessionListView();
  const auth = useFactoryAuth();
  const viewerUserId = auth.data?.user?.userId;
  const { setPinned } = usePinnedSessions();
  const [filterChanges, setFilterChanges] = useState<Partial<SessionFiltersState>>({});
  const [confirmDelete, setConfirmDelete] = useState<SessionListRow | null>(null);
  const deleteWorkspace = useDeleteWorkspaceMutation(factoryId, { agentControllerId: AGENT_CONTROLLER_ID, resourceId });
  const deleteUserSession = useDeleteUserSessionMutation(factoryId);
  const { regenerate, regenerating } = useRegenerateSessionTitle(factoryId);

  const defaultFilters = defaultSessionFilters(viewerUserId);
  const filters: SessionFiltersState = { ...defaultFilters, ...filterChanges };
  const activeFilterCount = activeSessionFilterCount(filters, defaultFilters);
  const hiddenGroupKeys = view.hiddenGroups[view.groupBy] ?? [];
  const changedCount =
    Number(view.sort !== DEFAULT_SESSION_SORT) +
    Number(view.groupBy !== DEFAULT_SESSION_GROUP_BY) +
    Number(hiddenGroupKeys.length > 0) +
    activeFilterCount;
  const changeFilters = (changes: Partial<SessionFiltersState>) =>
    setFilterChanges(current => ({ ...current, ...changes }));

  const sortedRows = rows.toSorted(compareSessionRows(view.sort));
  const filteredRows = filterSessionRows(sortedRows, filters, viewerUserId);
  const groupContext: SessionGroupContext = { boards: catalog.data, viewerUserId };
  const groups = groupSessionRows(filteredRows, view.groupBy, groupContext, hiddenGroupKeys);
  const changeGroupVisibility = (key: string, visible: boolean) =>
    updateView({
      hiddenGroups: {
        ...view.hiddenGroups,
        [view.groupBy]: visible ? hiddenGroupKeys.filter(hidden => hidden !== key) : [...hiddenGroupKeys, key],
      },
    });

  const pullRequestTargets = groups
    .flatMap(group => collapsedRowsKeepingActive(group.rows))
    .flatMap(row =>
      row.origin === 'factory' && row.threadId && row.pullRequestNumber !== undefined
        ? [
            {
              sessionId: row.session.sessionId,
              threadId: row.threadId,
              projectPath: row.session.sessionId,
              pullRequestNumber: row.pullRequestNumber,
              provider: row.provider,
              knownMerged: row.knownMerged,
            },
          ]
        : [],
    );
  const mergedByPath = useWorkspacePullRequestMerges({
    baseUrl,
    resourceId,
    targets: pullRequestTargets,
    enabled: sessionEnabled && Boolean(routeSessionId) && Boolean(resourceId),
  });

  if (!factoryId || (!hasRepositories && rows.length === 0)) return null;

  const pending = deleteWorkspace.isPending || deleteUserSession.isPending;
  const closeDeleteDialog = () => setConfirmDelete(null);
  const confirmDeleteSession = () => {
    if (!confirmDelete) return;
    if (confirmDelete.origin === 'factory') {
      deleteWorkspace.mutate(confirmDelete.session, { onSuccess: closeDeleteDialog });
    } else {
      deleteUserSession.mutate(confirmDelete.session, { onSettled: closeDeleteDialog });
    }
  };
  const openSession = (row: SessionListRow) =>
    void navigate(row.openPath, row.origin === 'factory' ? { state: { from: location } } : undefined);

  return (
    <section className="flex flex-col gap-2" aria-label="Sessions">
      <Sidebar.NavHeader
        icon={<MessagesSquare />}
        action={
          <div className="flex items-center gap-0.5">
            <SessionListProperties
              changedCount={changedCount}
              onReset={() => {
                resetView();
                setFilterChanges({});
              }}
            >
              <DropdownMenu.RadioSub
                label="Sort"
                icon={<ArrowUpDown aria-hidden />}
                options={SESSION_SORT_OPTIONS}
                value={view.sort}
                onValueChange={sort => updateView({ sort })}
              />
              <DropdownMenu.RadioSub
                label="Owner"
                icon={<UserRound aria-hidden />}
                options={sessionOwnerOptions(rows, viewerUserId)}
                value={filters.owner}
                onValueChange={owner => changeFilters({ owner })}
              />
              <DropdownMenu.RadioSub
                label="Status"
                icon={<CircleDashed aria-hidden />}
                options={SESSION_STATUS_OPTIONS}
                value={filters.status}
                onValueChange={status => changeFilters({ status })}
              />
              <DropdownMenu.RadioSub
                label="Updated"
                icon={<Clock aria-hidden />}
                options={SESSION_UPDATED_OPTIONS}
                value={filters.updated}
                onValueChange={updated => changeFilters({ updated })}
              />
              <SessionGroupMenu
                groupBy={view.groupBy}
                onGroupByChange={groupBy => updateView({ groupBy })}
                groups={sessionGroupOrder(sortedRows, view.groupBy, groupContext)}
                hiddenKeys={hiddenGroupKeys}
                onVisibilityChange={changeGroupVisibility}
              />
            </SessionListProperties>
            {hasRepositories && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New user session"
                onClick={() => void navigate(`/factories/${factoryId}/user/new/${crypto.randomUUID()}`)}
                disabled={pending}
              >
                <Plus size={15} />
              </Button>
            )}
          </div>
        }
      >
        Sessions
      </Sidebar.NavHeader>

      <div className="flex flex-col gap-4">
        {groups.map(group => (
          <SessionGroupList
            key={group.key}
            group={group}
            showHeader={view.groupBy !== 'none'}
            pending={pending}
            mergedByPath={mergedByPath}
            viewerUserId={viewerUserId}
            viewerProfile={auth.data?.user}
            regenerating={regenerating}
            onOpen={openSession}
            onPinChange={setPinned}
            onDelete={setConfirmDelete}
            onRegenerateTitle={row => regenerate(row.session)}
          />
        ))}
      </div>

      {loadFailed && (
        <div className="flex items-center gap-2 px-2 py-1">
          <Txt as="p" variant="meta" className="text-destructive-foreground m-0">
            Couldn’t load sessions
          </Txt>
          <Button variant="ghost" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      {loaded && filteredRows.length === 0 && (
        <Txt as="p" variant="meta" tone="muted" role="status" className="m-0 px-2 py-1">
          {emptyListMessage({ rowCount: rows.length, activeFilterCount, viewerKnown: Boolean(viewerUserId) })}
        </Txt>
      )}
      {loaded && filteredRows.length > 0 && groups.length === 0 && (
        <Txt as="p" variant="meta" tone="muted" role="status" className="m-0 px-2 py-1">
          All groups with sessions are hidden
        </Txt>
      )}

      {confirmDelete && (
        <DeleteSessionDialog
          row={confirmDelete}
          pending={pending}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteSession}
        />
      )}
    </section>
  );
}

function emptyListMessage({
  rowCount,
  activeFilterCount,
  viewerKnown,
}: {
  rowCount: number;
  activeFilterCount: number;
  viewerKnown: boolean;
}): string {
  if (rowCount === 0) return 'No sessions yet';
  if (activeFilterCount === 0 && viewerKnown) return 'No sessions of your own.';
  return 'No sessions match these filters';
}
