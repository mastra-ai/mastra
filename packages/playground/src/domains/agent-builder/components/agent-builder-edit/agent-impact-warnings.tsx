import { Star } from 'lucide-react';
import { useStoredAgentDependents } from '@/domains/agents/hooks/use-stored-agent-dependents';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';

const MAX_DEPENDENTS_SHOWN = 5;

type Variant = 'delete' | 'make-private';

const COPY: Record<
  Variant,
  {
    starredSingular: string;
    starredPlural: (count: number) => string;
    dependentsLeadSingular: string;
    dependentsLeadPlural: (count: number) => string;
    hiddenSingular: string;
    hiddenPlural: (count: number) => string;
  }
> = {
  delete: {
    starredSingular: 'This agent has been starred by 1 user. Deleting it will remove it from their starred list.',
    starredPlural: count =>
      `This agent has been starred by ${count} users. Deleting it will remove it from their starred lists.`,
    dependentsLeadSingular: '1 agent uses this agent as a sub-agent:',
    dependentsLeadPlural: count => `${count} agents use this agent as a sub-agent:`,
    hiddenSingular: '1 private agent in another workspace also references this agent and may stop working.',
    hiddenPlural: count =>
      `${count} private agents in other workspaces also reference this agent and may stop working.`,
  },
  'make-private': {
    starredSingular: 'This agent has been starred by 1 user. Making it private will hide it from their starred list.',
    starredPlural: count =>
      `This agent has been starred by ${count} users. Making it private will hide it from their starred lists.`,
    dependentsLeadSingular: '1 agent uses this agent as a sub-agent and may stop working for its author:',
    dependentsLeadPlural: count =>
      `${count} agents use this agent as a sub-agent and may stop working for their authors:`,
    hiddenSingular: '1 private agent in another workspace also references this agent and may stop working.',
    hiddenPlural: count =>
      `${count} private agents in other workspaces also reference this agent and may stop working.`,
  },
};

export interface AgentImpactWarningsProps {
  agentId: string;
  variant: Variant;
  /** When false the queries stay disabled (e.g. dialog closed). */
  enabled?: boolean;
}

export const AgentImpactWarnings = ({ agentId, variant, enabled = true }: AgentImpactWarningsProps) => {
  const { data: storedAgent } = useStoredAgent(agentId, { status: 'draft', enabled });
  const { data: dependentsData } = useStoredAgentDependents(agentId, { enabled });

  const starCount = storedAgent?.starCount ?? 0;
  const hasStars = starCount > 0;
  const dependents = dependentsData?.dependents ?? [];
  const visibleDependents = dependents.slice(0, MAX_DEPENDENTS_SHOWN);
  const remainingDependents = dependents.length - visibleDependents.length;
  const hiddenCount = dependentsData?.hiddenCount ?? 0;
  const hasHidden = hiddenCount > 0;
  const hasWarnings = hasStars || dependents.length > 0 || hasHidden;
  const copy = COPY[variant];

  if (!hasWarnings) return null;

  return (
    <div
      data-testid="agent-builder-agent-impact-warnings"
      className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
    >
      {hasStars && (
        <p data-testid="agent-builder-agent-impact-starred-warning" className="flex items-start gap-2">
          <Star className="mt-0.5 size-4 shrink-0 fill-current" aria-hidden />
          <span>{starCount === 1 ? copy.starredSingular : copy.starredPlural(starCount)}</span>
        </p>
      )}
      {dependents.length > 0 && (
        <div data-testid="agent-builder-agent-impact-dependents-warning" className={hasStars ? 'mt-2' : undefined}>
          <p>{dependents.length === 1 ? copy.dependentsLeadSingular : copy.dependentsLeadPlural(dependents.length)}</p>
          <ul className="mt-1 list-disc pl-5">
            {visibleDependents.map(dependent => (
              <li key={dependent.id} data-testid="agent-builder-agent-impact-dependent">
                {dependent.name}
              </li>
            ))}
            {remainingDependents > 0 && (
              <li data-testid="agent-builder-agent-impact-dependents-more">and {remainingDependents} more</li>
            )}
          </ul>
        </div>
      )}
      {hasHidden && (
        <p
          data-testid="agent-builder-agent-impact-hidden-warning"
          className={hasStars || dependents.length > 0 ? 'mt-2' : undefined}
        >
          {hiddenCount === 1 ? copy.hiddenSingular : copy.hiddenPlural(hiddenCount)}
        </p>
      )}
    </div>
  );
};
