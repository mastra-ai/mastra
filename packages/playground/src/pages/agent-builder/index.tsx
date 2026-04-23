import { Navigate } from 'react-router';

import { EmptyState } from '@mastra/playground-ui';
import { AlertTriangle, LockIcon, Settings } from 'lucide-react';

import { useBuilderAgentAccess } from '@/domains/builder/hooks/use-builder-agent-access';

/**
 * Agent Builder index page - redirects to first available feature.
 * Currently only supports agent creation; future features (library, etc.) will be added.
 */
export default function AgentBuilderIndex() {
  const { isLoading, denialReason, hasAgentFeature } = useBuilderAgentAccess();

  if (isLoading) {
    return null;
  }

  if (denialReason === 'permission-denied') {
    return (
      <div className="flex h-full items-center justify-center">
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
      <div className="flex h-full items-center justify-center">
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
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<Settings />}
          titleSlot="Agent Builder Not Configured"
          descriptionSlot="Agent Builder is not enabled. Contact your administrator to enable this feature."
        />
      </div>
    );
  }

  // Redirect to first available feature
  if (hasAgentFeature) {
    return <Navigate to="/agent-builder/agents/create" replace />;
  }

  // No features available (shouldn't reach here if denialReason logic is correct)
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<Settings />}
        titleSlot="No Features Enabled"
        descriptionSlot="No Agent Builder features are configured."
      />
    </div>
  );
}
