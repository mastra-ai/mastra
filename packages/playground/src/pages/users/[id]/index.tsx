import {
  Avatar,
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
  Button,
} from '@mastra/playground-ui';
import { ExternalLinkIcon } from 'lucide-react';
import { useParams, Link } from 'react-router';
import { useUser } from '@/domains/team/hooks';

function UserDetail() {
  const { id: userId } = useParams<{ id: string }>();
  const { data: user, isLoading, error } = useUser(userId || '');

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
        <PermissionDenied resource="user" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load user" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (isLoading || !user) {
    return (
      <PageLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-8">
        {/* User info */}
        <div className="flex items-center gap-4">
          <Avatar src={user.avatarUrl} name={user.name || user.email || user.id} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold text-text1">{user.name || user.email || user.id}</h1>
            {user.email && user.name && <p className="text-text2">{user.email}</p>}
          </div>
        </div>

        {/* Activity section */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Activity</h2>
          <p className="text-text2">View this customer's requests and activity in the traces view.</p>
          <Link to={`/traces?filterUserId=${userId}`}>
            <Button variant="outline">
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              View Traces
            </Button>
          </Link>
        </div>

        {/* Usage summary - placeholder for future */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Usage Summary</h2>
          <p className="text-text2 italic">Usage metrics coming soon.</p>
        </div>
      </div>
    </PageLayout>
  );
}

export { UserDetail };

export default UserDetail;
