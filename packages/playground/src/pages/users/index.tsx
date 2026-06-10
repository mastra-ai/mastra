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
import { Link } from 'react-router';

import { useUsers } from '@/domains/auth/hooks/use-users';

/**
 * Users list page - shows all server users (external customers).
 *
 * Users can click on a user to view their detail page,
 * which links to their activity traces.
 */
function Users() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useUsers({ search: search || undefined });

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
        <ErrorState title="Failed to load users" message={error.message} />
      </NoDataPageLayout>
    );
  }

  const users = data?.users || [];

  if (users.length === 0 && !isLoading && !search) {
    return (
      <NoDataPageLayout>
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-lg font-semibold">No Users</h2>
          <p className="text-mastra-el-3 max-w-md">
            No users found. Users will appear here once they authenticate with your server auth provider.
          </p>
        </div>
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter users" placeholder="Search by name or email" />
        </div>
      </PageLayout.TopArea>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-mastra-el-3">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-mastra-el-3">No users match your search</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {users.map(user => (
              <Link
                key={user.id}
                to={`/users/${user.id}`}
                className="bg-mastra-bg-2 hover:bg-mastra-bg-3 rounded-lg p-4 transition-colors border border-mastra-border-1"
              >
                <div className="flex items-center gap-4">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-mastra-bg-4 flex items-center justify-center text-mastra-el-3">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-mastra-el-1 truncate">{user.name || user.email || user.id}</div>
                    {user.name && user.email && <div className="text-sm text-mastra-el-3 truncate">{user.email}</div>}
                  </div>
                  {user.lastActiveAt && (
                    <div className="text-sm text-mastra-el-3">Last active: {formatRelativeTime(user.lastActiveAt)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {data?.total && data.total > users.length && (
          <div className="text-sm text-mastra-el-3 text-center py-2">
            Showing {users.length} of {data.total} users
          </div>
        )}
      </div>
    </PageLayout>
  );
}

/**
 * Format a date string to a relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  return 'Just now';
}

export { Users };

export default Users;
