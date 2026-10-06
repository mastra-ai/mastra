import { Txt } from '@mastra/playground-ui/components/Txt';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { raisedSurfaceStyle, surfaceGroupStateLayerStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHoverInGroup } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { NetworkIcon, WorkflowIcon } from 'lucide-react';
import { getRepoName } from './get-repo-name';

type Template = {
  slug: string;
  title: string;
  description: string;
  imageURL?: string;
  githubUrl: string;
  tags: string[];
  agents?: string[];
  tools?: string[];
  networks?: string[];
  workflows?: string[];
  mcp?: string[];
  supportedProviders: string[];
};

type TemplatesListProps = {
  templates: Template[];
  linkComponent?: React.ElementType;
  className?: string;
  isLoading?: boolean;
};

export function TemplatesList({ templates, linkComponent, className, isLoading }: TemplatesListProps) {
  const LinkComponent = linkComponent || 'a';

  if (isLoading) {
    return (
      <div className={cn('grid gap-y-4', className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-y-4', className)}>
      {templates.map(template => {
        const hasMetaInfo =
          template?.agents || template?.tools || template?.networks || template?.workflows || template?.mcp;

        return (
          <article
            className={cn(
              raisedSurfaceStyle,
              'state-layer grid w-full grid-cols-[1fr_auto] overflow-hidden rounded-lg',
            )}
            key={template.slug}
          >
            <LinkComponent
              to={`/templates/${template.slug}`}
              className={cn('group grid', {
                'grid-cols-[8rem_1fr] lg:grid-cols-[12rem_1fr]': template.imageURL,
              })}
            >
              {template.imageURL && (
                <div className="overflow-hidden">
                  <div
                    className="thumb transition-scale h-full w-full bg-cover duration-150"
                    style={{
                      backgroundImage: `url(${template.imageURL})`,
                    }}
                  />
                </div>
              )}
              <div
                className={cn(
                  'grid w-full gap-0.5 px-4 py-3',
                  '[&_svg]:h-[1em] [&_svg]:w-[1em] [&_svg]:text-muted-foreground',
                )}
              >
                <Txt as="h2" tone="ink">
                  {template.title}
                </Txt>
                <Txt className={cn(quietTextHoverInGroup, controlStateColorTransition)}>{template.description}</Txt>
                <div className="mt-3 hidden flex-wrap items-center gap-4 text-muted-foreground 2xl:flex">
                  {hasMetaInfo && (
                    <ul
                      className={cn(
                        'text-muted-foreground',
                        'm-0 flex list-none gap-4 p-0',
                        '[&>li]:flex [&>li]:items-center [&>li]:gap-0.5',
                      )}
                    >
                      {template?.agents && template.agents.length > 0 && (
                        <li>
                          <Txt as="span" variant="body" className="block">
                            <AgentIcon /> {template.agents.length}
                          </Txt>
                        </li>
                      )}
                      {template?.tools && template.tools.length > 0 && (
                        <li>
                          <Txt as="span" variant="body" className="block">
                            <ToolsIcon /> {template.tools.length}
                          </Txt>
                        </li>
                      )}
                      {template?.networks && template.networks.length > 0 && (
                        <li>
                          <Txt as="span" variant="body" className="block">
                            <NetworkIcon /> {template.networks.length}
                          </Txt>
                        </li>
                      )}
                      {template?.workflows && template.workflows.length > 0 && (
                        <li>
                          <Txt as="span" variant="body" className="block">
                            <WorkflowIcon /> {template.workflows.length}
                          </Txt>
                        </li>
                      )}
                      {template?.mcp && template.mcp.length > 0 && (
                        <li>
                          <Txt as="span" variant="body" className="block">
                            <McpServerIcon /> {template.mcp.length}
                          </Txt>
                        </li>
                      )}
                    </ul>
                  )}
                  {hasMetaInfo && template.supportedProviders && (
                    <small>
                      <Txt as="span" variant="body">
                        |
                      </Txt>
                    </small>
                  )}
                  <div className="flex items-center gap-4">
                    {template.supportedProviders.map(provider => (
                      <Txt tone="muted" as="span" variant="body" key={provider}>
                        {provider}
                      </Txt>
                    ))}
                  </div>
                </div>
              </div>
            </LinkComponent>
            <a
              href={template.githubUrl}
              className={cn('group ml-auto hidden items-center gap-2 pr-4', 'lg:flex')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Txt as="span" variant="body">
                <span
                  className={cn(
                    'flex items-center gap-2 rounded bg-sidebar px-2 py-1',
                    surfaceGroupStateLayerStyle,
                    quietTextHoverInGroup,
                    controlStateColorTransition,
                  )}
                >
                  <GithubIcon /> {getRepoName(template.githubUrl)}
                </span>
              </Txt>
            </a>
          </article>
        );
      })}
    </div>
  );
}
