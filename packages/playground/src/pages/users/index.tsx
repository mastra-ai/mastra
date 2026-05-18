import {
  Avatar,
  Button,
  ErrorState,
  ListSearch,
  NoDataPageLayout,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
  Skeleton,
} from '@mastra/playground-ui';
import { ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUsers } from '@/domains/team/hooks';
import type { User } from '@/domains/team/hooks';

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

function UserRow({ user }: { user: User }) {
  return (
    <Link
      to={`/users/${user.id}`}
      className="flex items-center gap-3 p-3 border-b border-border1 last:border-b-0 hover:bg-surface1 transition-colors cursor-pointer"
    >
      <Avatar src={user.avatarUrl} name={user.name || user.email || user.id} size="sm" />

      {/* Name/Email column */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text1 truncate">{user.name || user.email || user.id}</div>
        {user.email && user.name && <div className="text-sm text-text2 truncate">{user.email}</div>}
      </div>

      {/* Last active column */}
      <div className="w-32 text-sm text-text2 text-right">{formatLastActive(user.lastActiveAt)}</div>

      {/* Actions */}
      <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
        <Link to={`/observability?filterUserId=${user.id}`}>
          <Button variant="outline" size="sm">
            <ExternalLinkIcon className="h-3 w-3 mr-1" />
            Traces
          </Button>
        </Link>
      </div>
    </Link>
  );
}

function UsersTable({ users, isLoading, search }: { users: User[]; isLoading: boolean; search: string }) {
  const filteredUsers = search
    ? users.filter(
        u =>
          u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  if (isLoading) {
    return (
      <div className="border border-border1 rounded-lg overflow-hidden">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 p-3 border-b border-border1 bg-surface1">
          <div className="w-8" />
          <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">User</div>
          <div className="w-32 text-xs font-medium text-text2 uppercase tracking-wide text-right">Last Active</div>
          <div className="w-24" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 border-b border-border1 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="text-center py-8 text-text2">{search ? `No users match "${search}"` : 'No users found'}</div>
    );
  }

  return (
    <div className="border border-border1 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border1 bg-surface1">
        <div className="w-8" />
        <div className="flex-1 text-xs font-medium text-text2 uppercase tracking-wide">User</div>
        <div className="w-32 text-xs font-medium text-text2 uppercase tracking-wide text-right">Last Active</div>
        <div className="w-24" />
      </div>
      {filteredUsers.map(user => (
        <UserRow key={user.id} user={user} />
      ))}
    </div>
  );
}

function Users() {
  const { data, isLoading, error } = useUsers();
  const [search, setSearch] = useState('');
  const users = data?.users ?? [];

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

  if (users.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-text1">No Users</h2>
          <p className="text-text2">Users (customers) will appear here when they authenticate with your API.</p>
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

      <UsersTable users={users} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export { Users };

export default Users;
