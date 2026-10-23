import { Button } from '@mastra/playground-ui/components/Button';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { SquarePen } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { newUserSessionPath } from '../services/factoryPaths';

export function SidebarNewSessionButton() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factory = useFactoryQuery(factoryId);
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  const hasRepositories = (factory.data?.repositories.length ?? 0) > 0;
  if (!factoryId || !hasRepositories) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="New session"
      tooltip="New session"
      tooltipPosition="bottom"
      onClick={() => {
        void navigate(newUserSessionPath(factoryId));
        setOpenMobile(false);
      }}
    >
      <SquarePen />
    </Button>
  );
}
