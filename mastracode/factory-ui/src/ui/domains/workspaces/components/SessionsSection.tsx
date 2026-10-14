import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowUpDown, CircleDashed, Clock, MessagesSquare, Plus, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useWorkspacePullRequestMerges } from '../../../../hooks/useWorkspacePullRequestMerges';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useSessionDeletion } from '../hooks/useSessionDeletion';
import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionListRows } from '../hooks/useSessionListRows';
import { useSessionListView } from '../hooks/useSessionListView';
import {
  SESSION_STATUS_OPTIONS,
  SESSION_UPDATED_OPTIONS,
  filterSessionRows,
  sessionOwnerOptions,
} from '../services/sessionFilters';
import { collapsedRowsKeepingActive, groupSessionRowsByBoard } from '../services/sessionGroups';
import { pullRequestMergeTargets } from '../services/sessionRows';
import { SESSION_SORT_OPTIONS, compareSessionRows } from '../services/sessionSort';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { SessionGroupList } from './SessionGroupList';
import { SessionListItem } from './SessionListItem';
import { SessionListProperties } from './SessionListProperties';

export function SessionsSection() {
  const { factoryId, sessionId: routeSessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, resourceId, sessionEnabled } = useChatSessionContext();
  const navigate = useNavigate();
  const { rows, hasRepositories, loaded, loadFailed, retry } = useSessionListRows(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const { view, changedSettingCount, updateView, resetView } = useSessionListView();
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const { filters, activeFilterCount, changeFilters, resetFilters } = useSessionFilters(viewerUserId);
  const deletion = useSessionDeletion(factoryId, resourceId);

  const sortedRows = rows.toSorted(compareSessionRows(view.sort));
  const filteredRows = filterSessionRows(sortedRows, filters, viewerUserId);
  const groups = groupSessionRowsByBoard(filteredRows, catalog.data);
  const chatSessionOpen = sessionEnabled && Boolean(routeSessionId) && Boolean(resourceId);
  const mergedBySessionId = useWorkspacePullRequestMerges({
    baseUrl,
    resourceId,
    targets: pullRequestMergeTargets(groups.flatMap(group => collapsedRowsKeepingActive(group.rows))),
    enabled: chatSessionOpen,
  });

  if (!factoryId || (!hasRepositories && rows.length === 0)) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Sessions">
      <Sidebar.NavHeader
        icon={<MessagesSquare />}
        action={
          <div className="flex items-center gap-0.5">
            {hasRepositories && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New user session"
                onClick={() => void navigate(`/factories/${factoryId}/user/new/${crypto.randomUUID()}`)}
                disabled={deletion.deleting}
              >
                <Plus size={15} />
              </Button>
            )}
            <SessionListProperties
              changedCount={changedSettingCount + activeFilterCount}
              onReset={() => {
                resetView();
                resetFilters();
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
            </SessionListProperties>
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
            showHeader
            renderRow={row => (
              <SessionListItem
                key={row.session.sessionId}
                factoryId={factoryId}
                row={row}
                disabled={deletion.deleting}
                merged={row.pullRequest && (mergedBySessionId[row.session.sessionId] ?? row.pullRequest.knownMerged)}
                onDelete={deletion.requestDeletion}
              />
            )}
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

      {deletion.pendingConfirmation && (
        <DeleteSessionDialog
          row={deletion.pendingConfirmation}
          pending={deletion.deleting}
          onCancel={deletion.cancel}
          onConfirm={deletion.confirm}
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
