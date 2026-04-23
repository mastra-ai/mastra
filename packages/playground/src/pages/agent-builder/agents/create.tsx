import { EmptyState } from '@mastra/playground-ui';
import { AlertTriangle, LockIcon, Settings } from 'lucide-react';

import { useBuilderAgentAccess } from '@/domains/builder/hooks/use-builder-agent-access';

/**
 * Agent Builder create page shell.
 * Phase 3 will add the actual form implementation.
 */
export default function AgentBuilderCreatePage() {
  const { isLoading, denialReason, agentFeatures } = useBuilderAgentAccess();

  if (isLoading) {
    return null;
  }

  if (denialReason === 'permission-denied') {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<LockIcon />}
          titleSlot="Access Denied"
          descriptionSlot="You don't have permission to create agents."
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

  if (denialReason) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<Settings />}
          titleSlot="Agent Builder Not Configured"
          descriptionSlot="Agent creation is not enabled. Contact your administrator to enable this feature."
        />
      </div>
    );
  }

  // Phase 3 will replace this with actual form
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Create Agent</h1>
      <p className="text-muted-foreground mb-4">Agent Builder form will be implemented in Phase 3.</p>
      <pre className="bg-muted p-4 rounded text-sm">{JSON.stringify({ agentFeatures }, null, 2)}</pre>
    </div>
  );
}
