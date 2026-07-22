import { useLocation, useNavigate } from 'react-router';

import { FactoriesPanel } from '../domains/workspaces/components/FactoriesPanel';

/**
 * Dedicated Create Factory page (`/factories/create`). Lives outside the
 * factory-scoped routes (no active factory is required to create one), so it
 * renders standalone without the chat sidebar. Cancel/Escape returns to the
 * page the user came from (the factory switcher passes it via location
 * state); deep links fall back to `/`.
 */
export function CreateFactoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-surface2">
      <FactoriesPanel onClose={() => void navigate(from ?? '/')} />
    </main>
  );
}
