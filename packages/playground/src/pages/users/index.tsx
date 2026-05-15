import {
  Avatar,
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
import { useState } from 'react';
import { useUsers } from '@/domains/team/hooks';
import type { User } from '@/domains/team/hooks';

function UserRow({ user }: { user: User }) {
  return (
    <a
      href={`/users/${user.id}`}
      className="flex items-center gap-3 p-4 hover:bg-surface1 rounded-lg border border-border1 transition-colors"
    >
      <Avatar src={user.avatarUrl} name={user.name || user.email || user.id} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-text1 truncate">{user.name || user.email || user.id}</div>
        {user.email && user.name && <div className="text-sm text-text2 truncate">{user.email}</div>}
      </div>
    </a>
  );
}

function UsersList({ users, isLoading, search }: { users: User[]; isLoading: boolean; search: string }) {
  const filteredUsers = search
    ? users.filter(
        u =>
          u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
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
    <div className="space-y-3">
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

      <UsersList users={users} isLoading={isLoading} search={search} />
    </PageLayout>
  );
}

export { Users };

export default Users;
