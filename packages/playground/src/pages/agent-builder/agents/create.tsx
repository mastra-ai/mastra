import { EmptyState } from '@mastra/playground-ui';
import { AlertTriangle, LockIcon, Settings } from 'lucide-react';

import { AgentBuilderForm } from '@/domains/builder/components/agent-builder-form';
import { useBuilderAgentAccess } from '@/domains/builder/hooks/use-builder-agent-access';

/**
 * Agent Builder create page.
 * Shows config-driven form for creating agents.
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

  // Build visible sections from agent features
  const visibleSections = {
    tools: agentFeatures?.tools ?? false,
    memory: agentFeatures?.memory ?? false,
    skills: agentFeatures?.skills ?? false,
    workflows: agentFeatures?.workflows ?? false,
    agents: agentFeatures?.agents ?? false,
  };

  return <AgentBuilderForm visibleSections={visibleSections} />;
}
