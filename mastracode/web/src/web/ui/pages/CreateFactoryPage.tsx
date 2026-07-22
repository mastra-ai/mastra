import { useLocation, useNavigate } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactoriesPanel } from '../domains/workspaces/components/FactoriesPanel';
import { PageLayout } from '../ui';

/**
 * Dedicated Create Factory page (`/factories/create`). Rendered inside the
 * pathless <Chat /> layout so the sidebar and session providers stay mounted.
 * Cancel/Escape returns to the page the user came from (the factory switcher
 * passes it via location state); deep links fall back to `/new`.
 */
export function CreateFactoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <PageLayout sidebar={<Sidebar />} header={<ChatHeader />}>
      <FactoriesPanel onClose={() => void navigate(from ?? '/new')} />
    </PageLayout>
  );
}
