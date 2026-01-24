import { Link } from 'react-router';
import { useAuth } from '@/hooks/use-auth';
import { Settings, LogOut } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-surface2 flex items-center justify-end px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-neutral6">{user?.email}</span>
        <Link to="/settings" className="p-2 text-neutral6 hover:text-neutral9 hover:bg-surface3 rounded-md">
          <Settings className="h-4 w-4" />
        </Link>
        <button onClick={signOut} className="p-2 text-neutral6 hover:text-red-500 hover:bg-surface3 rounded-md">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
