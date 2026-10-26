import { useMaybeSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useNavigate } from 'react-router';

import { newUserSessionPath } from '../services/factoryPaths';

export function useOpenNewUserSession() {
  const navigate = useNavigate();
  const sidebar = useMaybeSidebar();

  return (factoryId: string) => {
    void navigate(newUserSessionPath(factoryId));
    sidebar?.setOpenMobile(false);
  };
}
