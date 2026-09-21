import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { quietTextHoverInGroup } from '@mastra/playground-ui/primitives/typography';
import { raisedSurfaceStyle, surfaceGroupStateLayerStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { NetworkIcon, WorkflowIcon } from 'lucide-react';
import { getRepoName } from './shared';

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
          <div key={index} className="bg-card h-16 animate-pulse rounded-lg" />
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
              'rounded-lg overflow-hidden w-full grid grid-cols-[1fr_auto] state-layer',
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
                <div className={cn('overflow-hidden')}>
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
                  'grid py-3 px-4 w-full gap-0.5',
                  '[&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-muted-foreground',
                )}
              >
                <h2 className="text-body text-foreground">{template.title}</h2>
                <p className={cn('text-body', quietTextHoverInGroup, controlStateColorTransition)}>
                  {template.description}
                </p>
                <div className="text-muted-foreground text-body mt-3 hidden flex-wrap items-center gap-4 2xl:flex">
                  {hasMetaInfo && (
                    <ul
                      className={cn(
                        'flex gap-4 text-body text-muted-foreground m-0 p-0 list-none',
                        '[&>li]:flex [&>li]:items-center [&>li]:gap-0.5 text-muted-foreground',
                      )}
                    >
                      {template?.agents && template.agents.length > 0 && (
                        <li>
                          <AgentIcon /> {template.agents.length}
                        </li>
                      )}
                      {template?.tools && template.tools.length > 0 && (
                        <li>
                          <ToolsIcon /> {template.tools.length}
                        </li>
                      )}
                      {template?.networks && template.networks.length > 0 && (
                        <li>
                          <NetworkIcon /> {template.networks.length}
                        </li>
                      )}
                      {template?.workflows && template.workflows.length > 0 && (
                        <li>
                          <WorkflowIcon /> {template.workflows.length}
                        </li>
                      )}
                      {template?.mcp && template.mcp.length > 0 && (
                        <li>
                          <McpServerIcon /> {template.mcp.length}
                        </li>
                      )}
                    </ul>
                  )}
                  {hasMetaInfo && template.supportedProviders && <small>|</small>}
                  <div className="text-muted-foreground flex items-center gap-4">
                    {template.supportedProviders.map(provider => (
                      <span key={provider} className="">
                        {provider}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </LinkComponent>
            <a
              href={template.githubUrl}
              className={cn('group items-center gap-2 text-body ml-auto pr-4 hidden', 'lg:flex')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span
                className={cn(
                  'bg-sidebar flex items-center gap-2 rounded px-2 py-1',
                  surfaceGroupStateLayerStyle,
                  quietTextHoverInGroup,
                  controlStateColorTransition,
                )}
              >
                <GithubIcon /> {getRepoName(template.githubUrl)}
              </span>
            </a>
          </article>
        );
      })}
    </div>
  );
}
