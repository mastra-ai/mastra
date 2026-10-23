import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowUpDown, CircleDashed, Clock, Plus, UserRound } from 'lucide-react';
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
import {
  collapsedRowsKeepingActive,
  groupSessionRows,
  orderGroupHeadings,
  sessionGroupHeadings,
} from '../services/sessionGroups';
import type { SessionGroupContext } from '../services/sessionGroups';
import { pullRequestMergeTargets } from '../services/sessionRows';
import { SESSION_SORT_OPTIONS, compareSessionRows } from '../services/sessionSort';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { SessionGroupList } from './SessionGroupList';
import { SessionGroupMenu } from './SessionGroupMenu';
import { SessionListItem } from './SessionListItem';
import { PropertiesMenu } from '../../../ui/PropertiesMenu';

export function SessionsSection() {
  const { factoryId, sessionId: routeSessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, sessionId, sessionEnabled } = useChatSessionContext();
  const navigate = useNavigate();
  const { rows, hasRepositories, loaded, loadFailed, retry } = useSessionListRows(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const {
    view,
    hiddenGroupKeys,
    groupOrderKeys,
    changedSettingCount,
    updateView,
    changeGroupVisibility,
    changeGroupOrder,
    resetView,
  } = useSessionListView();
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const { filters, activeFilterCount, changeFilters, resetFilters } = useSessionFilters();
  const deletion = useSessionDeletion(factoryId);

  const sortedRows = rows.toSorted(compareSessionRows(view.sort));
  const filteredRows = filterSessionRows(sortedRows, filters, viewerUserId);
  const groupContext: SessionGroupContext = { boards: catalog.data, viewerUserId };
  const defaultHeadings = sessionGroupHeadings(sortedRows, view.groupBy, groupContext);
  const menuGroups = orderGroupHeadings(defaultHeadings, groupOrderKeys);
  const groups = groupSessionRows(filteredRows, view.groupBy, menuGroups, hiddenGroupKeys);
  const chatSessionOpen = sessionEnabled && Boolean(routeSessionId) && Boolean(sessionId);
  const mergedBySessionId = useWorkspacePullRequestMerges({
    baseUrl,
    targets: pullRequestMergeTargets(groups.flatMap(group => collapsedRowsKeepingActive(group.rows))),
    enabled: chatSessionOpen,
  });

  const emptyMessage = emptyListMessage({
    rowCount: rows.length,
    filteredCount: filteredRows.length,
    groupCount: groups.length,
  });

  const nothingToList = !hasRepositories && rows.length === 0 && !loadFailed;
  if (!factoryId || nothingToList) return null;

  return (
    <section className="flex flex-col gap-2" aria-label="Sessions">
      <Sidebar.NavHeader
        className="mt-0"
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
            <PropertiesMenu
              label="Sessions properties"
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
              <SessionGroupMenu
                groupBy={view.groupBy}
                onGroupByChange={groupBy => updateView({ groupBy })}
                groups={menuGroups}
                hiddenKeys={hiddenGroupKeys}
                onVisibilityChange={changeGroupVisibility}
                onOrderChange={keys => changeGroupOrder(keys, defaultHeadings)}
              />
            </PropertiesMenu>
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
            renderRow={row => (
              <SessionListItem
                factoryId={factoryId}
                row={row}
                disabled={deletion.deleting}
                merged={mergedBySessionId[row.session.sessionId] ?? row.pullRequest?.knownMerged}
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
      {loaded && emptyMessage !== undefined && (
        <Txt as="p" variant="meta" tone="muted" role="status" className="m-0 px-2 py-1">
          {emptyMessage}
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
  filteredCount,
  groupCount,
}: {
  rowCount: number;
  filteredCount: number;
  groupCount: number;
}): string | undefined {
  if (filteredCount > 0) return groupCount === 0 ? 'All groups with sessions are hidden' : undefined;
  if (rowCount === 0) return 'No sessions yet';
  return 'No sessions match these filters';
}
