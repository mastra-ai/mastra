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
  SectionCard,
} from '@mastra/playground-ui';
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import { useParams, Link } from 'react-router';
import { useUser } from '@/domains/team/hooks';

function formatLastActive(date?: string): string {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

function formatDate(date?: string): string {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString();
}

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
      <PageLayout width="narrow">
        <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
          <Link to="/users" className="inline-flex items-center gap-2 text-text2 hover:text-text1 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Users
          </Link>
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </PageLayout.MainArea>
      </PageLayout>
    );
  }

  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        {/* Back link */}
        <Link to="/users" className="inline-flex items-center gap-2 text-text2 hover:text-text1 transition-colors">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Users
        </Link>

        {/* Profile section */}
        <SectionCard title="Customer Profile">
          <div className="flex items-center gap-4 py-2">
            <Avatar src={user.avatarUrl} name={user.name || user.email || user.id} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-text1 truncate">{user.name || user.email || user.id}</h1>
              {user.email && user.name && <p className="text-text2 truncate">{user.email}</p>}
              <div className="flex gap-4 mt-2 text-sm text-text2">
                <span>Customer since {formatDate(user.createdAt)}</span>
                <span>•</span>
                <span>Last active {formatLastActive(user.lastActiveAt)}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Activity section */}
        <SectionCard title="Activity" description="View this customer's requests and activity.">
          <div className="py-2 flex gap-3">
            <Link to={`/observability?filterUserId=${userId}`}>
              <Button variant="outline">
                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                View Traces
              </Button>
            </Link>
            <Link to={`/metrics?filterUserId=${userId}&period=30d`}>
              <Button variant="outline">
                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                View Metrics
              </Button>
            </Link>
          </div>
        </SectionCard>
      </PageLayout.MainArea>
    </PageLayout>
  );
}

export { UserDetail };

export default UserDetail;
