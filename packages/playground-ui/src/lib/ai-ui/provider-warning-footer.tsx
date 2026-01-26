import { AlertTriangle } from 'lucide-react';
import { useAgentsModelProviders } from '@/domains/agents/hooks/use-agents-model-providers';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { cleanProviderId } from '@/domains/agents/components/agent-metadata/utils';
import { cn } from '@/lib/utils';

export interface ProviderWarningFooterProps {
  agentId?: string;
}

export const ProviderWarningFooter = ({ agentId }: ProviderWarningFooterProps) => {
  const { data: agent } = useAgent(agentId);
  const { data: dataProviders, isLoading } = useAgentsModelProviders();

  if (isLoading || !agent || !agentId) {
    return null;
  }

  const providers = dataProviders?.providers || [];
  const currentProvider = cleanProviderId(agent.provider || '');
  const providerData = providers.find(p => cleanProviderId(p.id) === currentProvider);

  // Don't show warning if provider is connected or not found
  if (!providerData || providerData.connected) {
    return null;
  }

  const envVars = Array.isArray(providerData.envVar) ? providerData.envVar : [providerData.envVar];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-xs',
        'text-accent6 bg-transparent',
        'max-w-3xl w-full mx-auto',
      )}
      data-testid="provider-warning-footer"
    >
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        Set <code className="px-1 py-0.5 bg-surface4 rounded text-neutral6">{envVars.join(', ')}</code> to use{' '}
        {providerData.name}
      </span>
    </div>
  );
};
