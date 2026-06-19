import {
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { isWorkspaceNotSupportedError } from '@/domains/workspace/compatibility';
import { NoWorkspacesInfo, WorkspacesList } from '@/domains/workspace/components';
import { WorkspaceNotSupported } from '@/domains/workspace/components/workspace-not-supported';
import { useWorkspaces } from '@/domains/workspace/hooks/use-workspace';

function Workspaces() {
  const { data, isLoading, error } = useWorkspaces();
  const [search, setSearch] = useState('');

  const workspaces = data?.workspaces ?? [];

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="workspaces" />
      </NoDataPageLayout>
    );
  }

  if (error && isWorkspaceNotSupportedError(error)) {
    return (
      <NoDataPageLayout>
        <WorkspaceNotSupported />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState
          title="Failed to load workspaces"
          message={error instanceof Error ? error.message : 'Something went wrong'}
        />
      </NoDataPageLayout>
    );
  }

  if (workspaces.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoWorkspacesInfo />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter workspaces" placeholder="Filter by name or agent" />
        </div>
      </PageLayout.TopArea>

      <WorkspacesList workspaces={workspaces} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export { Workspaces };

export default Workspaces;
