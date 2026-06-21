import {
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  ThreadsTableView,
  is401UnauthorizedError,
  is403ForbiddenError,
  useMemoryThreads,
} from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { useLinkComponent } from '@/lib/framework';

function Memory() {
  const { data, isLoading, error } = useMemoryThreads();
  const navigate = useNavigate();
  const { Link } = useLinkComponent();

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
        <PermissionDenied resource="memory" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load threads" message={error.message} />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <ThreadsTableView
        threads={data?.threads ?? []}
        isLoading={isLoading}
        onThreadClick={thread => navigate(`/memory/${thread.id}`)}
        getThreadHref={thread => `/memory/${thread.id}`}
        LinkComponent={Link}
      />
    </PageLayout>
  );
}

export { Memory };
export default Memory;
