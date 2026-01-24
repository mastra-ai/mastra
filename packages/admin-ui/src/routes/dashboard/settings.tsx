import { useAuth } from '@/hooks/use-auth';

export function UserSettings() {
  const { user, signOut } = useAuth();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-neutral9 mb-6">User Settings</h1>

      <div className="space-y-6">
        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h2 className="text-lg font-medium text-neutral9 mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral6 mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral6"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral6 mb-1">Name</label>
              <input
                type="text"
                defaultValue={user?.user_metadata?.name || ''}
                className="w-full px-3 py-2 bg-surface3 border border-border rounded-md text-neutral9 focus:outline-none focus:ring-2 focus:ring-accent1"
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface2 rounded-lg border border-border">
          <h2 className="text-lg font-medium text-neutral9 mb-4">Account</h2>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
