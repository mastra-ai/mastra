import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgent } from '@mastra/react/hooks/agents';
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import { agentConfigurationSections } from './agent-configuration-sections';
import { AgentOverviewSections } from './agent-overview-panel/agent-overview-sections';
import { AgentWorkflowCards } from './agent-workflow-cards';

/** All developer configuration stays together, with stable anchors and inspection controls. */
export function AgentConfiguration() {
  const { agentId = '' } = useParams();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent, isLoading, error } = useAgent({ agentId, requestContext });
  const { Link } = useLinkComponent();
  const { pathname, search, hash } = useLocation();
  const isAgentLoaded = Boolean(agent);

  useEffect(() => {
    if (isAgentLoaded && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [isAgentLoaded, hash]);

  if (isLoading) return <Spinner aria-label="Loading agent" />;
  if (error || !agent)
    return <EmptyState tone="error" titleSlot="Could not load agent" descriptionSlot={error?.message} />;
  return (
    <PageLayout>
      <ActivatedSkillsProvider key={agentId}>
        <div className="@container mx-auto grid w-full max-w-6xl min-w-0 gap-6 pb-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
              <AgentIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <Txt as="h1" variant="title" className="break-words">
                {agent.name}
              </Txt>
              <Txt tone="muted">{agent.description || 'Agent configuration and connected resources.'}</Txt>
              <Txt variant="caption" tone="muted" font="mono" className="mt-1 [overflow-wrap:anywhere]">
                {agentId}
              </Txt>
            </div>
          </div>
          <div className="grid gap-3">
            <Txt as="h2" variant="heading">
              Configuration & resources
            </Txt>
            <nav aria-label="Configuration sections" className="flex flex-wrap gap-2">
              {agentConfigurationSections.map(section => (
                <Link
                  key={section.id}
                  href={`${pathname}${search}#${section.id}`}
                  className="text-ui-sm hover:bg-accent rounded-lg border border-border bg-card px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-border-focus"
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="grid min-w-0 gap-4">
            {agentConfigurationSections.map(section => (
              <div
                key={section.id}
                id={section.id}
                className="min-w-0 scroll-mt-4 rounded-xl border border-border bg-card"
              >
                {section.id === 'workflows' ? (
                  <section className="grid gap-3 p-4" aria-label="Attached workflows">
                    <Txt as="h3" variant="subheading">
                      Attached workflows
                    </Txt>
                    <AgentWorkflowCards workflows={agent.workflows} />
                  </section>
                ) : (
                  <AgentOverviewSections agentId={agentId} section={section.id} detailed />
                )}
              </div>
            ))}
          </div>
        </div>
      </ActivatedSkillsProvider>
    </PageLayout>
  );
}
