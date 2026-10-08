import type { GetAgentResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function AgentResourceCard({
  name,
  description,
  href,
  children,
}: {
  name: string;
  description?: string;
  href: string;
  children?: ReactNode;
}) {
  const { Link } = useLinkComponent();
  return (
    <Link
      href={href}
      className="hover:bg-accent grid min-w-0 gap-2 rounded-xl border border-border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-border-focus"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Txt as="h4" variant="subheading" className="[overflow-wrap:anywhere]">
          {name}
        </Txt>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {description && (
        <Txt tone="muted" className="[overflow-wrap:anywhere]">
          {description}
        </Txt>
      )}
      {children}
    </Link>
  );
}

export function AgentProcessorCards({ agent }: { agent: GetAgentResponse }) {
  const { paths } = useLinkComponent();
  const groups = [
    { phase: 'Input', processors: agent.inputProcessors ?? [] },
    { phase: 'Output', processors: agent.outputProcessors ?? [] },
  ];
  if (!groups.some(group => group.processors.length))
    return <Txt tone="muted">No processors attached to this agent.</Txt>;
  return (
    <div className="grid gap-3 @3xl:grid-cols-2">
      {groups.flatMap(({ phase, processors }) =>
        processors.map(processor => (
          <AgentResourceCard
            key={`${phase}:${processor.id}`}
            name={processor.name || processor.id}
            href={paths.processorLink(processor.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{phase}</Badge>
              <Txt variant="caption" tone="muted" className="[overflow-wrap:anywhere]">
                {processor.id}
              </Txt>
            </div>
          </AgentResourceCard>
        )),
      )}
    </div>
  );
}

export function AgentSkillCards({ agentId, agent }: { agentId: string; agent: GetAgentResponse }) {
  const { paths } = useLinkComponent();
  if (!agent.skills?.length) return <Txt tone="muted">No skills available to this agent.</Txt>;
  return (
    <div className="grid gap-3 @3xl:grid-cols-2">
      {agent.skills.map(skill => (
        <AgentResourceCard
          key={skill.path}
          name={skill.name}
          description={skill.description}
          href={paths.agentSkillLink(agentId, skill.name, skill.path, agent.workspaceId)}
        >
          <Txt variant="caption" tone="muted" className="[overflow-wrap:anywhere]">
            {skill.path}
            {skill.license ? ` · ${skill.license}` : ''}
          </Txt>
        </AgentResourceCard>
      ))}
    </div>
  );
}

export function AgentNetworkCards({ agent }: { agent: GetAgentResponse }) {
  const { paths } = useLinkComponent();
  const agents = Object.entries(agent.agents ?? {});
  if (!agents.length) return <Txt tone="muted">No agents attached for delegation.</Txt>;
  return (
    <div className="grid gap-3 @3xl:grid-cols-2">
      {agents.map(([id, attached]) => (
        <AgentResourceCard key={id} name={attached.name} href={paths.agentLink(id)}>
          <Txt variant="caption" tone="muted" className="[overflow-wrap:anywhere]">
            {id}
          </Txt>
        </AgentResourceCard>
      ))}
    </div>
  );
}
