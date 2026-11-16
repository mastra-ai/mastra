import { SESSION_ROW_WINDOW } from '@mastra/factory/session/session-row-limits';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Sidebar, useMaybeSidebarState } from '@mastra/playground-ui/components/Sidebar';
import { IconCircleDashed } from '@mastra/playground-ui/icons/central/IconCircleDashed';
import { IconClock } from '@mastra/playground-ui/icons/central/IconClock';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { useSessionPullRequestSubscriptions } from '../../../../hooks/useSessionPullRequestSubscriptions';
import { useSessionRowsQuery } from '../../../../hooks/useSessionRows';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useOpenNewUserSession } from '../hooks/useOpenNewUserSession';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import { useSessionDeletion } from '../hooks/useSessionDeletion';
import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionListView } from '../hooks/useSessionListView';
import { SESSION_GROUP_INCREMENT, orderGroupHeadings, sessionGroupHeadings } from '../services/sessionGroups';
import type { SessionGroup } from '../services/sessionGroups';
import { sessionRowsRequest } from '../services/sessionRowReads';
import { presentSessionRow, sessionOwners, sessionPullRequestTargets } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import { DeleteSessionDialog } from './DeleteSessionDialog';
import { SessionGroupList } from './SessionGroupList';
import { SessionGroupMenu } from './SessionGroupMenu';
import { SessionListItem } from './SessionListItem';
import { SidebarEmptyNote, SidebarLoadError } from '../../../ui/LoadErrorState';
import { PropertiesMenu } from '../../../ui/PropertiesMenu';
import { SidebarNavigationSkeleton } from '../../../ui/SidebarNavigationSkeleton';
import {
  SESSION_SORT_MENU_OPTIONS,
  SESSION_STATUS_MENU_OPTIONS,
  SESSION_UPDATED_MENU_OPTIONS,
  sessionOwnerMenuOptions,
} from './sessionPropertyOptions';
import { IconArrowTopBottom } from '@mastra/playground-ui/icons/central/IconArrowTopBottom';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';

const NO_EXTRA_ROWS: Readonly<Record<string, number>> = {};

export function SessionsSection() {
  const { factoryId, sessionId: routeSessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const openSessionId = useRouteSessionId();
  const openNewUserSession = useOpenNewUserSession();
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
  const sidebarState = useMaybeSidebarState()?.state;
  // Collapsed to icons, nested rows are hidden, so the card folds back and carries the open session.
  const children = view.revealChildSessions && sidebarState !== 'collapsed';
  const { filters, activeFilterCount, changeFilters, resetFilters } = useSessionFilters();
  const pinned = usePinnedSessions();
  const viewKey = JSON.stringify([view.sort, view.groupBy, filters, children]);
  const [deepened, setDeepened] = useState({ viewKey, extraRows: NO_EXTRA_ROWS });
  const extraRows = deepened.viewKey === viewKey ? deepened.extraRows : NO_EXTRA_ROWS;
  const deepen = (groupKey: string, extra: number | undefined) => {
    const { [groupKey]: _previous, ...others } = extraRows;
    setDeepened({ viewKey, extraRows: extra === undefined ? others : { ...others, [groupKey]: extra } });
  };
  const rowsRead = useSessionRowsQuery(
    factoryId,
    sessionRowsRequest({
      sort: view.sort,
      groupBy: view.groupBy,
      filters,
      pinned,
      open: openSessionId,
      children,
      windows: Object.fromEntries(
        Object.entries(extraRows).map(([groupKey, extra]) => [groupKey, SESSION_ROW_WINDOW + extra]),
      ),
    }),
  );
  const factory = useFactoryQuery(factoryId);
  const catalog = useBoardCatalog(factoryId);
  const viewer = useFactoryAuth().data?.user;
  const deletion = useSessionDeletion(factoryId);
  const { baseUrl, sessionId: chatSessionId, sessionEnabled } = useChatSessionContext();

  const response = rowsRead.data;
  const owners = sessionOwners(response?.owners ?? [], viewer);
  const defaultHeadings = sessionGroupHeadings(view.groupBy, {
    catalog: catalog.data,
    boardIds: response?.boards ?? [],
    owners,
    viewerUserId: viewer?.userId,
  });
  const menuGroups = orderGroupHeadings(defaultHeadings, groupOrderKeys);
  const groups: SessionGroup[] = factoryId
    ? menuGroups.flatMap(heading => {
        const group = response?.groups.find(candidate => candidate.key === heading.key);
        if (!group || hiddenGroupKeys.includes(heading.key)) return [];
        return [
          {
            ...heading,
            total: group.total,
            ...(group.openIndex !== undefined ? { openIndex: group.openIndex } : {}),
            rows: group.rows.map(row =>
              presentSessionRow(row, { factoryId, openSessionId, viewer, repositories: factory.data?.repositories }),
            ),
          },
        ];
      })
    : [];
  const subscriptionsBySessionId = useSessionPullRequestSubscriptions({
    baseUrl,
    targets: sessionPullRequestTargets(groups.flatMap(group => group.rows)),
    enabled: sessionEnabled && Boolean(routeSessionId) && Boolean(chatSessionId),
  });

  const loaded = rowsRead.isSuccess;
  const loadFailed = rowsRead.isError;
  const hasRepositories = (factory.data?.repositories.length ?? 0) > 0;
  const nothingToList = loaded && !hasRepositories && response?.total === 0 && !loadFailed;
  if (!factoryId || nothingToList) return null;

  const emptyMessage =
    response && !rowsRead.isPlaceholderData
      ? emptyListMessage({ total: response.total, matching: response.matching, groupCount: groups.length })
      : undefined;

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
                onClick={() => openNewUserSession(factoryId)}
                disabled={deletion.deleting}
              >
                <IconPlusMedium size={15} />
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
                icon={<IconArrowTopBottom aria-hidden />}
                options={SESSION_SORT_MENU_OPTIONS}
                value={view.sort}
                onValueChange={sort => updateView({ sort })}
              />
              <DropdownMenu.RadioSub
                label="Owner"
                icon={<IconUser aria-hidden />}
                options={sessionOwnerMenuOptions(owners, viewer?.userId)}
                value={filters.owner}
                onValueChange={owner => changeFilters({ owner })}
              />
              <DropdownMenu.RadioSub
                label="Status"
                icon={<IconCircleDashed aria-hidden />}
                options={SESSION_STATUS_MENU_OPTIONS}
                value={filters.status}
                onValueChange={status => changeFilters({ status })}
              />
              <DropdownMenu.RadioSub
                label="Updated"
                icon={<IconClock aria-hidden />}
                options={SESSION_UPDATED_MENU_OPTIONS}
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
              <DropdownMenu.Separator />
              <DropdownMenu.CheckboxItem checked={view.compact} onCheckedChange={compact => updateView({ compact })}>
                Compact view
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.CheckboxItem
                checked={view.revealChildSessions}
                onCheckedChange={revealChildSessions => updateView({ revealChildSessions })}
              >
                Reveal child sessions
              </DropdownMenu.CheckboxItem>
            </PropertiesMenu>
          </div>
        }
      >
        Sessions
      </Sidebar.NavHeader>

      <div className="flex flex-col gap-4">
        {!response && !loadFailed && <SidebarNavigationSkeleton label="Loading sessions" />}
        {groups.map(group => (
          <SessionGroupList
            key={group.key}
            group={group}
            showHeader={view.groupBy !== 'none'}
            onShowMore={() => deepen(group.key, (extraRows[group.key] ?? 0) + SESSION_GROUP_INCREMENT)}
            onShowLess={() => deepen(group.key, undefined)}
            renderRow={row => {
              const item = (entry: SessionListRow, level?: number, subItems?: ReactNode) => (
                <SessionListItem
                  key={entry.session.sessionId}
                  factoryId={factoryId}
                  row={entry}
                  subscriptions={subscriptionsBySessionId[entry.session.sessionId]}
                  level={level}
                  compact={view.compact}
                  disabled={deletion.deleting}
                  onDelete={deletion.requestDeletion}
                  subItems={subItems}
                />
              );
              return item(
                row,
                undefined,
                row.childRows?.length ? (
                  <Sidebar.NavList className="mt-0.5">{row.childRows.map(child => item(child, 1))}</Sidebar.NavList>
                ) : undefined,
              );
            }}
          />
        ))}
      </div>

      {loadFailed && (
        // Sessions has always reported a failed load without an alert; sharing the row doesn't change that.
        <SidebarLoadError onRetry={() => void rowsRead.refetch()} announce={false}>
          Couldn’t load sessions
        </SidebarLoadError>
      )}
      {emptyMessage !== undefined && <SidebarEmptyNote>{emptyMessage}</SidebarEmptyNote>}

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
  total,
  matching,
  groupCount,
}: {
  total: number;
  matching: number;
  groupCount: number;
}): string | undefined {
  if (matching > 0) return groupCount === 0 ? 'All groups with sessions are hidden' : undefined;
  if (total === 0) return 'No sessions yet';
  return 'No sessions match these filters';
}
