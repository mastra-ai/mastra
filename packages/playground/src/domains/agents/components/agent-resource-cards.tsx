import type { GetAgentResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function AgentResourceList({ children }: { children: ReactNode }) {
  return <div className="-mx-3 grid min-w-0 gap-1 @3xl:grid-cols-2 @3xl:gap-x-4">{children}</div>;
}

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
      className="group flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-normal ease-out-custom hover:bg-fill-subtle focus-visible:outline-2 focus-visible:outline-border-focus motion-reduce:transition-none"
    >
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Txt as="h4" variant="label" className="[overflow-wrap:anywhere]">
          {name}
        </Txt>
        {description && (
          <Txt variant="body-sm" tone="muted" className="[overflow-wrap:anywhere]">
            {description}
          </Txt>
        )}
        {children}
      </div>
      <ArrowUpRight
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-normal group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      />
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
    <AgentResourceList>
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
    </AgentResourceList>
  );
}

export function AgentSkillCards({ agentId, agent }: { agentId: string; agent: GetAgentResponse }) {
  const { paths } = useLinkComponent();
  if (!agent.skills?.length) return <Txt tone="muted">No skills available to this agent.</Txt>;
  return (
    <AgentResourceList>
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
    </AgentResourceList>
  );
}

export function AgentNetworkCards({ agent }: { agent: GetAgentResponse }) {
  const { paths } = useLinkComponent();
  const agents = Object.entries(agent.agents ?? {});
  if (!agents.length) return <Txt tone="muted">No agents attached for delegation.</Txt>;
  return (
    <AgentResourceList>
      {agents.map(([id, attached]) => (
        <AgentResourceCard key={id} name={attached.name} href={paths.agentLink(id)}>
          <Txt variant="caption" tone="muted" className="[overflow-wrap:anywhere]">
            {id}
          </Txt>
        </AgentResourceCard>
      ))}
    </AgentResourceList>
  );
}
