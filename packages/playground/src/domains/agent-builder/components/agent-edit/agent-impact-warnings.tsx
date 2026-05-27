import { useStoredAgentDependents } from '@/domains/agents/hooks/use-stored-agents';

const MAX_DEPENDENTS_SHOWN = 5;

type Variant = 'delete' | 'make-private';

const COPY: Record<
  Variant,
  {
    dependents: string;
    private: (n: number) => string;
    hidden: (n: number) => string;
  }
> = {
  delete: {
    dependents: 'This agent is used as a sub-agent by:',
    private: n => `${n} of your private agent${n === 1 ? '' : 's'} also reference${n === 1 ? 's' : ''} this agent.`,
    hidden: n => `${n} private agent${n === 1 ? '' : 's'} in other workspaces also reference this agent.`,
  },
  'make-private': {
    dependents: 'Making this agent private may break the following agents that use it as a sub-agent:',
    private: n =>
      `${n} of your private agent${n === 1 ? '' : 's'} also reference${n === 1 ? 's' : ''} this agent and may stop working.`,
    hidden: n =>
      `${n} private agent${n === 1 ? '' : 's'} in other workspaces also reference this agent and may stop working.`,
  },
};

interface AgentImpactWarningsProps {
  agentId: string;
  variant: Variant;
  enabled?: boolean;
}

export const AgentImpactWarnings = ({ agentId, variant, enabled = true }: AgentImpactWarningsProps) => {
  const { data, isLoading, isError } = useStoredAgentDependents(agentId, { enabled });

  if (!enabled || isLoading || isError) return null;

  const dependents = data?.dependents ?? [];
  const privateCount = data?.privateCount ?? 0;
  const hiddenCount = data?.hiddenCount ?? 0;

  if (dependents.length === 0 && privateCount === 0 && hiddenCount === 0) return null;

  const copy = COPY[variant];
  const visible = dependents.slice(0, MAX_DEPENDENTS_SHOWN);
  const overflow = dependents.length - visible.length;

  return (
    <div
      data-testid="agent-impact-warnings"
      className="mt-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm"
    >
      {dependents.length > 0 && (
        <div data-testid="agent-impact-dependents-warning">
          <p className="font-medium">{copy.dependents}</p>
          <ul className="mt-1 list-disc pl-5">
            {visible.map(dep => (
              <li key={dep.id} data-testid="agent-impact-dependent">
                {dep.name}
              </li>
            ))}
          </ul>
          {overflow > 0 && (
            <p data-testid="agent-impact-dependents-more" className="mt-1 text-icon-3">
              and {overflow} more
            </p>
          )}
        </div>
      )}
      {privateCount > 0 && (
        <p data-testid="agent-impact-private-warning" className={dependents.length > 0 ? 'mt-2' : ''}>
          {copy.private(privateCount)}
        </p>
      )}
      {hiddenCount > 0 && (
        <p
          data-testid="agent-impact-hidden-warning"
          className={dependents.length > 0 || privateCount > 0 ? 'mt-2' : ''}
        >
          {copy.hidden(hiddenCount)}
        </p>
      )}
    </div>
  );
};
