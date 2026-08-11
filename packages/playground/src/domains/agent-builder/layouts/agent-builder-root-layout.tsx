import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { AlertTriangle, ArrowLeft, Eye, LockIcon, Settings } from 'lucide-react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useBuilderAgentAccess } from '../hooks/use-builder-agent-access';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useRoleImpersonation } from '@/domains/auth/hooks/use-role-impersonation';
import { isAuthenticated } from '@/domains/auth/types';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';

export interface AgentBuilderRootLayoutProps {
  paths: LinkComponentProviderProps['paths'];
}

export const AgentBuilderRootLayout = ({ paths }: AgentBuilderRootLayoutProps) => {
  const location = useLocation();
  const { data: authCapabilities, isLoading } = useAuthCapabilities();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (authCapabilities?.enabled && !isAuthenticated(authCapabilities)) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    const url = `/login?redirect=${encodeURIComponent(redirectPath)}`;
    return <Navigate to={url} replace />;
  }

  return <AgentBuilderPermissionsGuard paths={paths} />;
};

const AgentBuilderPermissionsGuard = ({ paths }: AgentBuilderRootLayoutProps) => {
  const navigate = useNavigate();
  const { isLoading, denialReason, hasAgentFeature } = useBuilderAgentAccess();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (denialReason === 'permission-denied') {
    return <AccessDeniedScreen />;
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

function AccessDeniedScreen() {
  const { isImpersonating, impersonatedRole, stopImpersonation } = useRoleImpersonation();

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <EmptyState
          iconSlot={<LockIcon />}
          titleSlot="Access Denied"
          descriptionSlot="You don't have permission to access the Agent Builder."
        />
        <div className="flex items-center gap-2">
          <Button as={Link} href="/agents" variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Studio
          </Button>
          {isImpersonating && (
            <Button variant="default" size="sm" onClick={stopImpersonation}>
              <Eye className="h-3.5 w-3.5" />
              Exit {impersonatedRole?.name} preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
