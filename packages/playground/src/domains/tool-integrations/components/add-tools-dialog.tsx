import {
  Button,
  Checkbox,
  ScrollArea,
  Searchbar,
  SearchbarWrapper,
  SideDialog,
  Skeleton,
  Txt,
  cn,
} from '@mastra/playground-ui';
import { useEffect, useMemo, useState } from 'react';

import { useToolIntegrations } from '../hooks/use-tool-integrations';
import { useTools } from '../hooks/use-tools';

interface SelectableTool {
  integrationId: string;
  toolService: string;
  slug: string;
  name: string;
  description?: string;
}

export interface AddToolsDialogSelection {
  /** Stable composite id: `${integrationId}:${slug}`. */
  toolId: string;
  integrationId: string;
  toolService: string;
  slug: string;
}

export interface AddToolsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Composite ids already selected on the agent: `${integrationId}:${slug}`. */
  initialSelectedIds?: Set<string>;
  onSubmit: (selection: AddToolsDialogSelection[]) => void;
}

const PER_PAGE = 50;

export const AddToolsDialog = ({ open, onClose, initialSelectedIds, onSubmit }: AddToolsDialogProps) => {
  const { data: integrationsResponse, isLoading: integrationsLoading } = useToolIntegrations();
  const integrations = useMemo(() => integrationsResponse?.integrations ?? [], [integrationsResponse]);
  const [activeIntegrationId, setActiveIntegrationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState<Map<string, SelectableTool>>(new Map());

  // Default to first integration when dialog opens.
  useEffect(() => {
    if (!open) return;
    if (!activeIntegrationId && integrations[0]?.id) {
      setActiveIntegrationId(integrations[0].id);
    }
  }, [open, integrations, activeIntegrationId]);

  // Reset local state when reopened.
  useEffect(() => {
    if (open) {
      setLocalSelection(new Map());
      setSearch('');
    }
  }, [open]);

  const { data: toolsResponse, isLoading: toolsLoading } = useTools(activeIntegrationId, {
    search: search.trim() || undefined,
    page: 1,
    perPage: PER_PAGE,
  });

  const tools = toolsResponse?.data ?? [];

  const toggleTool = (tool: SelectableTool) => {
    const key = `${tool.integrationId}:${tool.slug}`;
    setLocalSelection(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, tool);
      return next;
    });
  };

  const handleSubmit = () => {
    const selection: AddToolsDialogSelection[] = Array.from(localSelection.values()).map(t => ({
      toolId: `${t.integrationId}:${t.slug}`,
      integrationId: t.integrationId,
      toolService: t.toolService,
      slug: t.slug,
    }));
    onSubmit(selection);
    onClose();
  };

  const submitLabel = useMemo(() => {
    const n = localSelection.size;
    if (n === 0) return 'Add tools';
    return `Add ${n} tool${n !== 1 ? 's' : ''}`;
  }, [localSelection.size]);

  return (
    <SideDialog
      isOpen={open}
      onClose={onClose}
      dialogTitle="Add tools"
      dialogDescription="Browse tools from your tool integrations"
      level={1}
    >
      <SideDialog.Header className="px-9 pt-6">
        <SideDialog.Heading>Add tools</SideDialog.Heading>
        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={localSelection.size === 0}>
          {submitLabel}
        </Button>
      </SideDialog.Header>

      <div className="px-9 pb-3 flex flex-wrap gap-2" data-testid="add-tools-dialog-provider-chips">
        {integrationsLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          (integrations ?? []).map(integration => {
            const isActive = integration.id === activeIntegrationId;
            return (
              <button
                key={integration.id}
                type="button"
                onClick={() => setActiveIntegrationId(integration.id)}
                data-testid={`add-tools-dialog-chip-${integration.id}`}
                aria-pressed={isActive}
                className={cn(
                  'rounded-full border px-3 py-1 text-ui-sm transition-colors',
                  isActive
                    ? 'border-accent3 bg-accent3/10 text-accent3'
                    : 'border-border1 text-neutral4 hover:bg-surface3',
                )}
              >
                {integration.displayName}
              </button>
            );
          })
        )}
      </div>

      <div className="px-9 pb-3" data-testid="add-tools-dialog-search">
        <SearchbarWrapper>
          <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools..." />
        </SearchbarWrapper>
      </div>

      <ScrollArea className="flex-1 px-9 pb-6">
        {toolsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tools.length === 0 ? (
          <Txt as="p" variant="ui-sm" className="text-neutral3 py-6 text-center">
            No tools found.
          </Txt>
        ) : (
          <ul className="flex flex-col gap-1">
            {tools.map(tool => {
              const key = `${activeIntegrationId}:${tool.slug}`;
              const selectable: SelectableTool = {
                integrationId: activeIntegrationId!,
                toolService: tool.toolService,
                slug: tool.slug,
                name: tool.name,
                description: tool.description,
              };
              const checked = localSelection.has(key) || (initialSelectedIds?.has(key) ?? false);
              const alreadyOnAgent = initialSelectedIds?.has(key) ?? false;
              return (
                <li key={tool.slug}>
                  <label
                    className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface3 cursor-pointer"
                    data-testid={`add-tools-dialog-tool-${tool.slug}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={alreadyOnAgent}
                      onCheckedChange={() => toggleTool(selectable)}
                    />
                    <div className="flex-1">
                      <Txt as="span" variant="ui-sm" className="text-neutral6 block">
                        {tool.name}
                      </Txt>
                      {tool.description && (
                        <Txt as="span" variant="ui-xs" className="text-neutral3 block">
                          {tool.description}
                        </Txt>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </SideDialog>
  );
};
