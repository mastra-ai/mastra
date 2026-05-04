import { EmptyState, Spinner, Toaster, TooltipProvider } from '@mastra/playground-ui';
import { AlertTriangle, LockIcon, Settings } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useBuilderAgentAccess } from '../hooks/use-builder-agent-access';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';

export interface AgentBuilderRootLayoutProps {
  paths: LinkComponentProviderProps['paths'];
}

function buildAgentBuilderLoginRedirect(pathname: string, search = '', hash = '') {
  const redirectPath = `${pathname}${search}${hash}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

export const AgentBuilderRootLayout = ({ paths }: AgentBuilderRootLayoutProps) => {
  const location = useLocation();
  const { data: authCapabilities, isLoading } = useAuthCapabilities();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (authCapabilities?.enabled && !isAuthenticated(authCapabilities)) {
    return <Navigate to={buildAgentBuilderLoginRedirect(location.pathname, location.search, location.hash)} replace />;
  }

  return <AgentBuilderPermissionsGuard paths={paths} />;
};

const AgentBuilderPermissionsGuard = ({ paths }: AgentBuilderRootLayoutProps) => {
  const navigate = useNavigate();
  const { isLoading, denialReason, hasAgentFeature } = useBuilderAgentAccess();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (denialReason === 'permission-denied') {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          iconSlot={<LockIcon />}
          titleSlot="Access Denied"
          descriptionSlot="You don't have permission to access the Agent Builder."
        />
      </div>
    );
  }

  if (denialReason === 'error') {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          iconSlot={<AlertTriangle />}
          titleSlot="Error"
          descriptionSlot="Failed to load Agent Builder configuration."
        />
      </div>
    );
  }

  if (denialReason === 'not-configured') {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          iconSlot={<Settings />}
          titleSlot="Agent Builder Not Configured"
          descriptionSlot="Agent Builder is not enabled. Contact your administrator to enable this feature."
        />
      </div>
    );
  }

  // Redirect to first available feature
  if (!hasAgentFeature) {
    return (
      <div className="flex h-screen items-center justify-center">
        <EmptyState
          iconSlot={<Settings />}
          titleSlot="No Features Enabled"
          descriptionSlot="No Agent Builder features are configured."
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={navigate} paths={paths}>
        <Outlet />
        <Toaster position="bottom-right" />
      </LinkComponentProvider>
    </TooltipProvider>
  );
};
