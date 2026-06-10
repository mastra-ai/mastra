import {
  ErrorState,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useUser } from '@/domains/auth/hooks/use-users';

/**
 * User detail page - shows details for a single server user.
 *
 * Includes a link to view the user's activity traces in the observability page.
 */
function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { data: user, isLoading, error } = useUser(userId);

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
        <PermissionDenied resource="users" />
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

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-8">
          <span className="text-mastra-el-3">Loading user...</span>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    return (
      <NoDataPageLayout>
        <ErrorState title="User not found" message="The user you're looking for doesn't exist." />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <Link to="/users" className="flex items-center gap-1 text-mastra-el-3 hover:text-mastra-el-1 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Users</span>
        </Link>
      </PageLayout.TopArea>

      <div className="max-w-2xl mx-auto">
        <div className="bg-mastra-bg-2 rounded-lg p-6 border border-mastra-border-1">
          <div className="flex items-start gap-6">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-20 h-20 rounded-full" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-mastra-bg-4 flex items-center justify-center text-2xl text-mastra-el-3">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-mastra-el-1">{user.name || 'Unnamed User'}</h1>
              {user.email && <p className="text-mastra-el-3 mt-1">{user.email}</p>}

              <div className="mt-4 flex flex-col gap-2">
                {user.createdAt && (
                  <div className="text-sm text-mastra-el-3">
                    <span className="text-mastra-el-2">Joined:</span> {formatDate(user.createdAt)}
                  </div>
                )}
                {user.lastActiveAt && (
                  <div className="text-sm text-mastra-el-3">
                    <span className="text-mastra-el-2">Last active:</span> {formatDate(user.lastActiveAt)}
                  </div>
                )}
                {user.role && (
                  <div className="text-sm text-mastra-el-3">
                    <span className="text-mastra-el-2">Role:</span> {user.role}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-mastra-border-1">
            <Link
              to={`/traces?filterUserId=${user.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-mastra-bg-accent text-mastra-el-accent rounded-lg hover:opacity-90 transition-opacity"
            >
              <span>View Activity Traces</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

/**
 * Format a date string to a human-readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export { UserDetail };

export default UserDetail;
