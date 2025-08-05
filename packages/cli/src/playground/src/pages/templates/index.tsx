import {
  AgentIcon,
  GithubIcon,
  Header,
  HeaderTitle,
  MainContentLayout,
  McpServerIcon,
  ToolsIcon,
} from '@mastra/playground-ui';
import { useTemplates } from '@/domains/templates/use-templates';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';
import { NetworkIcon, SearchIcon, WorkflowIcon } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function Templates() {
  const { data: templates, tags, providers } = useTemplates();
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleFilterChange = (value: string, filter: string) => {
    if (filter === 'tag') {
      setSelectedTag(value);
    } else if (filter === 'provider') {
      setSelectedProvider(value);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);
  };

  const filteredTemplates = templates.filter(template => {
    if (
      searchTerm &&
      !template.title.toLowerCase().includes(searchTerm) &&
      !template.description.toLowerCase().includes(searchTerm)
    ) {
      return false;
    }
    if (selectedTag !== 'all' && !template.tags.includes(selectedTag)) {
      return false;
    }
    if (selectedProvider !== 'all' && !template.supportedProviders.includes(selectedProvider)) {
      return false;
    }
    return true;
  });

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Templates</HeaderTitle>
      </Header>

      <div className={cn('max-w-[80rem] w-full px-[3rem] mx-auto grid gap-y-[1rem] ')}>
        <div className={cn(`h-full overflow-y-scroll `)}>
          <div
            className={cn(
              'flex  my-[2rem]',
              '[&>div]:flex gap-[1rem] [&>div]:items-center [&>div]:gap-[1rem]',
              '[&_label]:shrink-0',
            )}
          >
            <div className="flex items-center gap-2 rounded-lg border border-border1">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search for a tool"
                className="w-full py-2 bg-transparent text-icon3 focus:text-icon6 placeholder:text-icon3 outline-none"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div>
              <Label>Filter by tag</Label>
              <Select
                name="filter-by-entity"
                onValueChange={value => {
                  handleFilterChange(value, 'tag');
                }}
                defaultValue={'all'}
                value={selectedTag || 'all'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all" value="all">
                    All
                  </SelectItem>
                  {(tags || []).map(tag => (
                    <SelectItem key={tag} value={`${tag}`}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filter by provider</Label>
              <Select
                name="filter-by-entity"
                onValueChange={value => {
                  handleFilterChange(value, 'provider');
                }}
                defaultValue={'all'}
                value={selectedProvider || 'all'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all" value="all">
                    All
                  </SelectItem>
                  {(providers || []).map(provider => (
                    <SelectItem key={provider} value={`${provider}`}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-y-[1rem]">
            {filteredTemplates.map(template => {
              const hasMetaInfo =
                template?.agents || template?.tools || template?.networks || template?.workflows || template?.mcp;

              return (
                <article
                  className={cn(
                    'border border-border1 rounded-lg overflow-hidden w-full grid grid-cols-[1fr_auto] bg-surface3 transition-colors hover:bg-surface4',
                  )}
                  key={template.slug}
                >
                  <Link
                    to={`/templates/${template.slug}`}
                    className={cn('grid  [&:hover_p]:text-icon5 ', {
                      'grid-cols-[12rem_1fr]': template.imageURL,
                    })}
                  >
                    {template.imageURL && (
                      <div className="relative overflow-hidden  ">
                        <div
                          className="w-full h-full bg-cover thumb transition-scale duration-150"
                          style={{
                            backgroundImage: `url(${template.imageURL})`,
                          }}
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        'grid py-[.75rem] px-[1.5rem] w-full gap-[0.1rem]',
                        '[&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-icon3',
                      )}
                    >
                      <h2 className="text-[1rem] text-icon5">{template.title}</h2>
                      <p className="text-[0.875rem] text-icon4 transition-colors duration-500">
                        {template.description}
                      </p>
                      <div className="text-icon3 text-[0.875rem] flex items-center gap-[1rem] mt-[0.75rem]">
                        {hasMetaInfo && (
                          <ul
                            className={cn(
                              'flex gap-[1rem] text-[0.875rem] text-icon3 m-0 p-0 list-none',
                              '[&>li]:flex [&>li]:items-center [&>li]:gap-[0.1rem] text-icon4',
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
                        <div className="flex items-center text-icon3 gap-[1rem]">
                          {template.supportedProviders.map(provider => (
                            <span key={provider} className="">
                              {provider}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                  <a
                    href={template.githubUrl}
                    className="group flex items-center gap-[0.5rem] text-[0.875rem] ml-auto pr-[1rem]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="flex items-center gap-[0.5rem]  px-[0.5rem] py-[0.25rem] rounded bg:surface1 group-hover:bg-surface2 text-icon3 transition-colors group-hover:text-icon5 ">
                      <GithubIcon /> {getRepoName(template.githubUrl)}
                    </span>
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </MainContentLayout>
  );
}

function getRepoName(githubUrl: string) {
  return githubUrl.split('/').pop();
}
