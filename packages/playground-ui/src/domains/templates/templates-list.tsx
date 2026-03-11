import { AgentIcon, GithubIcon, GoogleIcon, McpServerIcon, ToolsIcon } from '@/ds/icons';
import { OpenaiChatIcon } from '@/ds/icons/OpenaiChatIcon';
import { AnthropicChatIcon } from '@/ds/icons/AnthropicChatIcon';
import { GroqIcon } from '@/ds/icons/GroqIcon';
import { MistralIcon } from '@/ds/icons/MistralIcon';
import { CohereIcon } from '@/ds/icons/CohereIcon';
import { AmazonIcon } from '@/ds/icons/AmazonIcon';
import { AzureIcon } from '@/ds/icons/AzureIcon';
import { NetworkIcon, WorkflowIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Column } from '@/ds/components/Columns';
import { Chip } from '@/ds/components/Chip';
import { EmptyState } from '@/ds/components/EmptyState';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { ListSearch } from '@/ds/components/ListSearch';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { useLinkComponent } from '@/lib/framework';
import { getRepoName } from './shared';

const providerIcons: Record<string, React.ReactNode> = {
  openai: <OpenaiChatIcon />,
  anthropic: <AnthropicChatIcon />,
  google: <GoogleIcon />,
  groq: <GroqIcon />,
  mistral: <MistralIcon />,
  cohere: <CohereIcon />,
  amazon: <AmazonIcon />,
  azure: <AzureIcon />,
};

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

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'entities', label: 'Entities', size: '10rem' },
  { name: 'providers', label: 'Providers', size: '10rem' },
  { name: 'repo', label: 'Repository', size: '12rem' },
];

export type TemplatesListProps = {
  templates: Template[];
  tags: string[];
  providers: string[];
  isLoading?: boolean;
};

export function TemplatesList({ templates, tags, providers, isLoading }: TemplatesListProps) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const { navigate } = useLinkComponent();

  const tagOptions = useMemo(
    () => [{ value: 'all', label: 'Any tag' }, ...tags.map(t => ({ value: t, label: t }))],
    [tags],
  );

  const providerOptions = useMemo(
    () => [{ value: 'all', label: 'Any provider' }, ...providers.map(p => ({ value: p, label: p }))],
    [providers],
  );

  const hasActiveFilters = selectedTag !== 'all' || selectedProvider !== 'all';

  const handleReset = () => {
    setSelectedTag('all');
    setSelectedProvider('all');
  };

  const filteredTemplates = useMemo(() => {
    const term = search.toLowerCase();
    return templates.filter(template => {
      const matchesSearch =
        !term || template.title.toLowerCase().includes(term) || template.description.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      if (selectedTag !== 'all' && !template.tags.includes(selectedTag)) return false;
      if (selectedProvider !== 'all' && !template.supportedProviders.includes(selectedProvider)) return false;
      return true;
    });
  }, [templates, search, selectedTag, selectedProvider]);

  if (templates.length === 0 && !isLoading) {
    return <EmptyTemplatesList />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter templates" placeholder="Filter by name or description" />
        <SelectFieldBlock
          name="filter-tag"
          label="Filter by tag"
          labelIsHidden
          value={selectedTag}
          options={tagOptions}
          onValueChange={setSelectedTag}
        />
        <SelectFieldBlock
          name="filter-provider"
          label="Filter by provider"
          labelIsHidden
          value={selectedProvider}
          options={providerOptions}
          onValueChange={setSelectedProvider}
        />
        {hasActiveFilters && (
          <Button onClick={handleReset}>
            <XIcon />
            Reset
          </Button>
        )}
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredTemplates.map(template => {
                const agentsCount = template.agents?.length ?? 0;
                const toolsCount = template.tools?.length ?? 0;
                const networksCount = template.networks?.length ?? 0;
                const workflowsCount = template.workflows?.length ?? 0;
                const mcpCount = template.mcp?.length ?? 0;
                const hasEntities = agentsCount + toolsCount + networksCount + workflowsCount + mcpCount > 0;

                return (
                  <ItemList.Row key={template.slug}>
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: template.slug }}
                      onClick={() => navigate(`/templates/${template.slug}`)}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid">
                        <span className="text-neutral4 text-ui-md truncate">{template.title}</span>
                        <span className="text-neutral2 text-ui-md truncate pr-6">{template.description}</span>
                      </ItemList.TextCell>

                      <ItemList.Cell>
                        {hasEntities && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="text-neutral2 text-ui-sm inline-flex gap-1 items-center">
                                {agentsCount > 0 && (
                                  <Chip color="purple" intensity="muted">
                                    <AgentIcon /> {agentsCount}
                                  </Chip>
                                )}
                                {toolsCount > 0 && (
                                  <Chip color="yellow" intensity="muted">
                                    <ToolsIcon /> {toolsCount}
                                  </Chip>
                                )}
                                {workflowsCount > 0 && (
                                  <Chip color="blue" intensity="muted">
                                    <WorkflowIcon /> {workflowsCount}
                                  </Chip>
                                )}
                                {networksCount > 0 && (
                                  <Chip color="green" intensity="muted">
                                    <NetworkIcon /> {networksCount}
                                  </Chip>
                                )}
                                {mcpCount > 0 && (
                                  <Chip intensity="muted">
                                    <McpServerIcon /> {mcpCount}
                                  </Chip>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex flex-col gap-1">
                                <strong>Includes:</strong>
                                {agentsCount > 0 && (
                                  <span>
                                    {agentsCount} agent{agentsCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {toolsCount > 0 && (
                                  <span>
                                    {toolsCount} tool{toolsCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {workflowsCount > 0 && (
                                  <span>
                                    {workflowsCount} workflow{workflowsCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {networksCount > 0 && (
                                  <span>
                                    {networksCount} network{networksCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {mcpCount > 0 && (
                                  <span>
                                    {mcpCount} MCP server{mcpCount !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </ItemList.Cell>

                      <ItemList.Cell className="flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 [&_svg]:w-4 [&_svg]:h-4 opacity-70">
                              {template.supportedProviders.map(p => {
                                const icon = providerIcons[p.toLowerCase()];
                                return icon ? <span key={p}>{icon}</span> : null;
                              })}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{template.supportedProviders.join(', ')}</TooltipContent>
                        </Tooltip>
                      </ItemList.Cell>

                      <ItemList.Cell className="flex items-center gap-1.5">
                        <GithubIcon className="w-4 h-4 text-neutral3 shrink-0" />
                        <span className="truncate text-neutral3 text-ui-sm">{getRepoName(template.githubUrl)}</span>
                      </ItemList.Cell>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
          </ItemList>
        )}
      </Column.Content>
    </Column>
  );
}

const EmptyTemplatesList = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<GithubIcon className="h-8 w-8" />}
      titleSlot="No Templates"
      descriptionSlot="No templates are available at the moment."
    />
  </div>
);
