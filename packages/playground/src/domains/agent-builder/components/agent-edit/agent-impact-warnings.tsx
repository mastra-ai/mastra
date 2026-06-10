import { useStoredAgentDependents } from '@/domains/agents/hooks/use-stored-agents';

const MAX_DEPENDENTS_SHOWN = 5;

type Variant = 'delete' | 'make-private';

const COPY: Record<
  Variant,
  {
    dependents: string;
    hidden: (n: number) => string;
  }
> = {
  delete: {
    dependents: 'This agent is used as a sub-agent by:',
    hidden: n =>
      n === 1
        ? '1 other private agent also references this agent.'
        : `${n} other private agents also reference this agent.`,
  },
  'make-private': {
    dependents: 'Making this agent private may break the following agents that use it as a sub-agent:',
    hidden: n =>
      n === 1
        ? '1 other private agent also references this agent and may stop working.'
        : `${n} other private agents also reference this agent and may stop working.`,
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
  const hiddenCount = data?.hiddenCount ?? 0;

  if (dependents.length === 0 && hiddenCount === 0) return null;

  const copy = COPY[variant];
  const visible = dependents.slice(0, MAX_DEPENDENTS_SHOWN);
  const overflow = dependents.length - visible.length;

  return (
    <div data-testid="agent-impact-warnings" className="text-ui-sm text-neutral3">
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
      {hiddenCount > 0 && (
        <p data-testid="agent-impact-hidden-warning" className={dependents.length > 0 ? 'mt-2' : ''}>
          {copy.hidden(hiddenCount)}
        </p>
      )}
    </div>
  );
};
