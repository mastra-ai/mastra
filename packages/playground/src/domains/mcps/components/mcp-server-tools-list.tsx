import type { McpServerInfo, McpToolInfo } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useMCPServerTools } from '../hooks/useMCPServerTools';
import { ToolIconMap } from '@/domains/tools/components/ToolIcon';

const COLUMNS = 'auto 1fr auto';

const TOOL_TYPE_LABELS = { tool: 'Tool', agent: 'Agent', workflow: 'Workflow' } as const;

function isKnownToolType(type: string): type is keyof typeof ToolIconMap {
  return type in ToolIconMap;
}

function ToolTypeIcon({ type }: { type: string }) {
  const known = isKnownToolType(type) ? type : 'tool';
  const Icon = ToolIconMap[known];
  const label = TOOL_TYPE_LABELS[known];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={known} className="text-neutral3 inline-flex [&>svg]:size-4">
          <Icon />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const appUiMetaSchema = z.object({
  ui: z.object({ resourceUri: z.string().optional() }).optional(),
  'ui/resourceUri': z.string().optional(),
});

function hasAppUi(meta: McpToolInfo['_meta']): boolean {
  const result = appUiMetaSchema.safeParse(meta);
  if (!result.success) return false;
  return Boolean(
    result.data.ui?.resourceUri?.startsWith('ui://') || result.data['ui/resourceUri']?.startsWith('ui://'),
  );
}

export function McpServerToolsList({ server }: { server: McpServerInfo }) {
  const [search, setSearch] = useState('');
  const { data: tools = {}, isLoading } = useMCPServerTools(server);
  const { Link, paths } = useLinkComponent();

  const filteredTools = useMemo(() => {
    const term = search.toLowerCase();
    return Object.values(tools).filter(
      tool => tool.name.toLowerCase().includes(term) || tool.description?.toLowerCase().includes(term),
    );
  }, [tools, search]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredTools.length });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Txt as="h2" variant="heading">
          Available tools
        </Txt>
        <div className="max-w-120 flex-1">
          <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name" shortcutDisabled />
        </div>
      </div>

      {isLoading ? (
        <DataListSkeleton columns={COLUMNS} />
      ) : (
        <DataList columns={COLUMNS} scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Name</DataList.TopCell>
            <DataList.TopCell>Description</DataList.TopCell>
            <DataList.TopCell className="justify-center text-center">Type</DataList.TopCell>
          </DataList.Top>

          {filteredTools.length === 0 && search ? <DataList.NoMatch message="No tools match your search" /> : null}

          {filteredTools.map((tool, index) => (
            <DataList.RowLink
              key={tool.name}
              to={paths.mcpServerToolLink(server.id, tool.name)}
              LinkComponent={Link}
              {...getRowProps(index)}
            >
              <DataList.NameCell>
                <span className="flex items-center gap-2">
                  {tool.name}
                  {hasAppUi(tool._meta) && <Badge size="xs">App</Badge>}
                </span>
              </DataList.NameCell>
              <DataList.DescriptionCell>{tool.description}</DataList.DescriptionCell>
              <DataList.TextCell className="justify-center text-center">
                <ToolTypeIcon type={tool.toolType ?? 'tool'} />
              </DataList.TextCell>
            </DataList.RowLink>
          ))}
        </DataList>
      )}
    </section>
  );
}
