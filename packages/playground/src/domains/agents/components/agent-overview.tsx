import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useAgent } from '@mastra/react/hooks/agents';
import { ArrowDown, Boxes, Settings2, Workflow } from 'lucide-react';
import { Navigate, useLocation, useParams } from 'react-router';
import { extractPrompt } from '../utils/extractPrompt';
import { AgentActivity } from './agent-activity';
import { AgentCapabilitySummary } from './agent-capability-summary';
import { agentConfigurationSections } from './agent-configuration-sections';
import { AgentNetworkCards } from './agent-resource-cards';
import { AgentWorkflowCards } from './agent-workflow-cards';

/** Purpose, capabilities and activity at a glance, with detailed controls in Configuration. */
export function AgentOverview() {
  const { agentId = '' } = useParams();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent, isLoading, error } = useAgent({ agentId, requestContext });
  const { Link } = useLinkComponent();
  const { search, hash } = useLocation();

  if (agentConfigurationSections.some(section => hash === `#${section.id}`))
    return <Navigate replace to={`/agents/${encodeURIComponent(agentId)}/configuration${search}${hash}`} />;

  if (isLoading) return <Spinner aria-label="Loading agent" />;
  if (error || !agent)
    return <EmptyState tone="error" titleSlot="Could not load agent" descriptionSlot={error?.message} />;

  const configurationPath = `/agents/${encodeURIComponent(agentId)}/configuration${search}`;
  const models = agent.modelList?.filter(model => model.enabled !== false);
  const hasRelationships = Object.keys(agent.workflows ?? {}).length > 0 || Object.keys(agent.agents ?? {}).length > 0;

  return (
    <PageLayout>
      <div className="@container mx-auto grid w-full max-w-6xl min-w-0 gap-6 pb-6">
        <header className="flex min-w-0 flex-wrap items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <AgentIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <Txt as="h1" variant="title" className="break-words">
              {agent.name}
            </Txt>
            <Txt tone="muted" className="line-clamp-3 [overflow-wrap:anywhere]">
              {agent.description ||
                extractPrompt(agent.instructions) ||
                'Explore this agent’s capabilities, connected resources and recent activity.'}
            </Txt>
          </div>
          <Button render={<Link href={configurationPath} />} icon={<Settings2 />}>
            Configuration
          </Button>
        </header>

        <div className="grid min-w-0 gap-4 @2xl:grid-cols-2">
          <section
            aria-label="Configured model"
            className="grid min-w-0 content-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Txt as="h2" variant="subheading" className="flex items-center gap-2">
              <Boxes className="size-4 text-muted-foreground" />
              Configured model
            </Txt>
            {models?.length ? (
              <div className="grid gap-2">
                {models.map(model => (
                  <div key={model.id} className="min-w-0">
                    <Txt className="[overflow-wrap:anywhere]">{model.model.modelId}</Txt>
                    <Txt variant="caption" tone="muted">
                      {model.model.provider}
                    </Txt>
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-w-0">
                <Txt className="[overflow-wrap:anywhere]">{agent.modelId || 'Dynamic model'}</Txt>
                <Txt variant="caption" tone="muted">
                  {agent.provider}
                </Txt>
              </div>
            )}
            <Link
              href={`${configurationPath}#models`}
              className="text-ui-sm w-fit text-muted-foreground hover:underline"
            >
              Model settings
            </Link>
          </section>
          <AgentActivity agentId={agentId} variant="overview" />
        </div>

        <AgentCapabilitySummary agent={agent} />

        <section aria-label="Connected capabilities" className="grid min-w-0 gap-3">
          <div>
            <Txt as="h2" variant="heading">
              Connected capabilities
            </Txt>
            <Txt tone="muted">Workflows this agent can run and agents it can delegate to.</Txt>
          </div>
          {hasRelationships ? (
            <div className="grid min-w-0 gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex min-w-0 items-center gap-2">
                <AgentIcon className="size-5 shrink-0" />
                <Txt variant="subheading" className="[overflow-wrap:anywhere]">
                  {agent.name}
                </Txt>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowDown className="size-4 shrink-0" />
                <Txt variant="caption">Available to call</Txt>
              </div>
              {Object.keys(agent.workflows ?? {}).length > 0 && (
                <section aria-label="Attached workflows" className="grid min-w-0 gap-3">
                  <Txt as="h3" variant="subheading" className="flex items-center gap-2">
                    <Workflow className="size-4 text-muted-foreground" /> Workflows
                  </Txt>
                  <AgentWorkflowCards workflows={agent.workflows} />
                </section>
              )}
              {Object.keys(agent.agents ?? {}).length > 0 && (
                <section aria-label="Delegated agents" className="grid min-w-0 gap-3">
                  <Txt as="h3" variant="subheading">
                    Delegated agents
                  </Txt>
                  <AgentNetworkCards agent={agent} />
                </section>
              )}
            </div>
          ) : (
            <Txt tone="muted">No workflows or delegated agents attached.</Txt>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
