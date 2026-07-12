import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
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
          <div key={index} className="h-16 animate-pulse rounded-lg bg-surface3" />
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
              'grid w-full grid-cols-[1fr_auto] overflow-hidden rounded-lg border border-border1 bg-surface3 transition-colors hover:bg-surface4',
            )}
            key={template.slug}
          >
            <LinkComponent
              to={`/templates/${template.slug}`}
              className={cn('grid [&:hover_p]:text-neutral5', {
                'grid-cols-[8rem_1fr] lg:grid-cols-[12rem_1fr]': template.imageURL,
              })}
            >
              {template.imageURL && (
                <div className={cn('overflow-hidden')}>
                  <div
                    className="thumb transition-scale size-full bg-cover duration-150"
                    style={{
                      backgroundImage: `url(${template.imageURL})`,
                    }}
                  />
                </div>
              )}
              <div className={cn('grid w-full gap-0.5 px-6 py-3', '[&_svg]:size-[1em] [&_svg]:text-neutral3')}>
                <h2 className="text-ui-lg text-neutral5">{template.title}</h2>
                <p className="text-ui-md text-neutral4 transition-colors duration-500">{template.description}</p>
                <div className="mt-3 hidden flex-wrap items-center gap-4 text-ui-md text-neutral3 2xl:flex">
                  {hasMetaInfo && (
                    <ul
                      className={cn(
                        'm-0 flex list-none gap-4 p-0 text-ui-md text-neutral3',
                        'text-neutral4 [&>li]:flex [&>li]:items-center [&>li]:gap-0.5',
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
                  <div className="flex items-center gap-4 text-neutral3">
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
              className={cn('group ml-auto hidden items-center gap-2 pr-4 text-ui-md', 'lg:flex')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="flex items-center gap-2 rounded bg-surface1 px-2 py-1 text-neutral3 transition-colors group-hover:bg-surface2 group-hover:text-neutral5">
                <GithubIcon /> {getRepoName(template.githubUrl)}
              </span>
            </a>
          </article>
        );
      })}
    </div>
  );
}
