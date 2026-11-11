import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useListSearch } from '@mastra/playground-ui/hooks/use-list-search';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useAgents } from '@mastra/react/hooks/agents';
import { useTools } from '@mastra/react/hooks/tools';
import { SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { navCrumb } from '@/domains/navigation/crumbs';
import { ToolDrawer } from '@/domains/tools/components/tool-drawer/tool-drawer';
import { ToolsPageDrawerBody } from '@/domains/tools/components/tool-drawer/tools-page-tool-drawer-body';
import { NoToolsInfo } from '@/domains/tools/components/tools-list/no-tools-info';
import { ToolsList } from '@/domains/tools/components/tools-list/tools-list';
import type { ToolsSort } from '@/domains/tools/components/tools-list/tools-list';
import { useToolDrawerParam } from '@/domains/tools/hooks/use-tool-drawer-param';

const crumbs = [navCrumb('/tools')];

export default function Tools() {
  const { data: agentsRecord = {}, isLoading: isLoadingAgents, error: agentsError } = useAgents();
  const { data: tools = {}, isLoading: isLoadingTools, error: toolsError } = useTools();
  const [search, setSearch] = useState('');
  const searchField = useListSearch({ onSearch: setSearch });
  const [sort, setSort] = useState<ToolsSort>();
  const { toolId: openToolId } = useToolDrawerParam();

  const isLoading = isLoadingAgents || isLoadingTools;
  const error = toolsError || agentsError;

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <PermissionDenied variant="fill" resource="tools" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load tools" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  if (Object.keys(tools).length === 0 && !isLoading) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Tools</h1>
        <NoToolsInfo />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <div className="max-w-120 flex-1">
              <InputGroup size="sm" className="w-full max-w-120">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput {...searchField.inputProps} aria-label="Search tools" placeholder="Search by name" />
                {searchField.value && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton aria-label="Clear search" onClick={searchField.clear}>
                      <XIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <h1 className="sr-only">Tools</h1>
      <ToolsList
        tools={tools}
        agents={agentsRecord}
        isLoading={isLoading}
        search={search}
        sort={sort}
        onSortChange={(direction, key) => setSort({ key, direction })}
        selectedToolId={openToolId}
      />
      <ToolDrawer>
        <ToolsPageDrawerBody />
      </ToolDrawer>
    </PageLayout>
  );
}
