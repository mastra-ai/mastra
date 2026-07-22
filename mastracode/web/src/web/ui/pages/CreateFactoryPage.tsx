import { useLocation, useNavigate } from 'react-router';

import { Sidebar } from '../Sidebar';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { FactoriesPanel } from '../domains/workspaces/components/FactoriesPanel';
import { sourceFactoryPath } from '../domains/workspaces/services/factoryPaths';
import { PageLayout } from '../ui/PageLayout';

/**
 * Dedicated Create Factory page (`/factories/create`). The route remains
 * outside the active factory's URL space while its layout restores the source
 * factory context, allowing this page to keep the standard application shell.
 * Cancel/Escape returns to the source page; deep links fall back to `/`.
 */
export function CreateFactoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = sourceFactoryPath(location.state);

  return (
    <PageLayout sidebar={<Sidebar />} header={<ChatHeader />}>
      <FactoriesPanel onClose={() => void navigate(from ?? '/')} />
    </PageLayout>
  );
}
