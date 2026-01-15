'use client';

import { useState } from 'react';
import { Plus, Plug2, Trash2, Loader2, Wrench, Check, Search, Pencil, X } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { Skeleton } from '@/ds/components/Skeleton';
import { Icon } from '@/ds/icons';
import { Input } from '@/ds/components/Input';
import { Checkbox } from '@/ds/components/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ds/components/Dialog';
import { toast } from '@/lib/toast';

import { IntegrationCard } from './integration-card';
import { AddToolsDialog } from './add-tools-dialog';
import { useIntegrations, useIntegrationMutations, useProviderTools } from '../hooks';
import { useTools } from '../../tools/hooks';
import type { IntegrationConfig } from '@mastra/client-js';

/**
 * Props for the IntegrationsList component.
 */
export interface IntegrationsListProps {
  /** Optional callback when an integration is selected for editing */
  onEditIntegration?: (integration: IntegrationConfig) => void;
  /** Optional class name for styling */
  className?: string;
  /** Optional external control of the add dialog open state */
  addDialogOpen?: boolean;
  /** Optional callback when add dialog open state changes (required if addDialogOpen is provided) */
  onAddDialogOpenChange?: (open: boolean) => void;
  /** Hide the internal Add Integration button (use when button is rendered externally) */
  hideAddButton?: boolean;
}

/**
 * Component that displays a list of all configured integrations.
 */
export function IntegrationsList({
  onEditIntegration,
  className,
  addDialogOpen,
  onAddDialogOpenChange,
  hideAddButton = false,
}: IntegrationsListProps) {
  // Internal state for dialog when not controlled externally
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const isAddDialogOpen = addDialogOpen !== undefined ? addDialogOpen : internalDialogOpen;
  const setIsAddDialogOpen = onAddDialogOpenChange || setInternalDialogOpen;

  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null);
  const { data, isLoading, refetch } = useIntegrations();

  const integrations = data?.integrations || [];
  const hasIntegrations = integrations.length > 0;

  const handleEdit = (integration: IntegrationConfig) => {
    if (onEditIntegration) {
      onEditIntegration(integration);
    } else {
      setEditingIntegration(integration);
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface2">
            <Plug2 className="h-5 w-5 text-icon4" />
          </div>
          <div>
            <Txt variant="ui-lg" className="font-semibold text-icon6">
              Integrations
            </Txt>
            {hasIntegrations && (
              <Txt variant="ui-sm" className="text-icon3">
                {integrations.length} connected source{integrations.length === 1 ? '' : 's'}
              </Txt>
            )}
          </div>
        </div>

        {!hideAddButton && (
          <Button variant="default" size="md" onClick={() => setIsAddDialogOpen(true)}>
            <Icon>
              <Plus className="h-4 w-4" />
            </Icon>
            Add Integration
          </Button>
        )}
      </div>

      {/* Content */}
      {hasIntegrations ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrations.map(integration => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onEdit={handleEdit}
              onDeleted={() => refetch()}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-surface1 rounded-xl border border-dashed border-border2">
          <div className="p-4 rounded-full bg-surface2 mb-4">
            <Plug2 className="h-8 w-8 text-icon3" />
          </div>
          <Txt variant="ui-lg" className="text-icon6 font-medium mb-2">
            No integrations yet
          </Txt>
          <Txt variant="ui-sm" className="text-icon3 text-center max-w-md mb-6">
            Connect external tool providers like MCP servers, Composio, or Arcade to import tools for your agents.
          </Txt>
          {!hideAddButton && (
            <Button variant="default" size="md" onClick={() => setIsAddDialogOpen(true)}>
              <Icon>
                <Plus className="h-4 w-4" />
              </Icon>
              Add Your First Integration
            </Button>
          )}
        </div>
      )}

      <AddToolsDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => refetch()}
      />

      {editingIntegration && (
        <EditIntegrationDialog
          integration={editingIntegration}
          open={!!editingIntegration}
          onOpenChange={(open) => {
            if (!open) {
              setEditingIntegration(null);
              refetch();
            }
          }}
          onUpdated={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * Props for EditIntegrationDialog
 */
interface EditIntegrationDialogProps {
  integration: IntegrationConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the integration is updated (e.g., renamed) */
  onUpdated?: () => void;
}

/**
 * Type for integration tools displayed in the edit dialog
 */
interface IntegrationToolItem {
  id: string;
  name: string;
  description?: string;
  toolkit?: string;
  toolSlug?: string;
  integrationId: string;
  cachedToolId: string;
}

/**
 * Type for available tools from provider
 */
interface AvailableTool {
  slug: string;
  name: string;
  description?: string;
  toolkit?: string;
}

/**
 * Dialog for viewing and managing tools in an integration.
 *
 * Mental model:
 * - Composio/Arcade: Integration = Provider + Toolkit (e.g., "Hackernews from Composio")
 * - MCP: Integration = specific MCP server connection
 * - Edit allows adding/removing tools WITHIN that scope only
 */
function EditIntegrationDialog({ integration, open, onOpenChange, onUpdated }: EditIntegrationDialogProps) {
  const { data: tools = {}, refetch: refetchTools } = useTools();
  const { deleteTool, updateIntegration } = useIntegrationMutations(integration.id);
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [isAddingTools, setIsAddingTools] = useState(false);
  const [selectedNewTools, setSelectedNewTools] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [editedName, setEditedName] = useState(integration.name);
  const [isSavingName, setIsSavingName] = useState(false);

  const isMCP = integration.provider === 'mcp';
  const isSmithery = integration.provider === 'smithery';
  const isMCPLike = isMCP || isSmithery; // Both use MCP connection under the hood

  // Filter tools that belong to this integration (currently added)
  const integrationTools: IntegrationToolItem[] = Object.entries(tools)
    .filter(([_, tool]) => (tool as unknown as Record<string, unknown>).integrationId === integration.id)
    .map(([id, tool]) => {
      const t = tool as unknown as Record<string, unknown>;
      return {
        id,
        name: t.name as string,
        description: t.description as string | undefined,
        toolkit: t.toolkit as string | undefined,
        toolSlug: t.toolSlug as string | undefined,
        integrationId: t.integrationId as string,
        cachedToolId: t.cachedToolId as string,
      };
    });

  // Get the toolkit slugs for this integration (for fetching available tools)
  const toolkitSlugs = integration.selectedToolkits || [];

  // Set of tool slugs already added
  const addedToolSlugs = new Set(integrationTools.map(t => t.toolSlug).filter(Boolean));

  // Build MCP params from stored metadata (works for both MCP and Smithery integrations)
  const mcpMetadata = integration.metadata as Record<string, unknown> | undefined;
  const mcpToolsParams = isMCPLike && mcpMetadata
    ? mcpMetadata.url
      ? {
          url: mcpMetadata.url as string,
          headers: mcpMetadata.headers ? JSON.stringify(mcpMetadata.headers) : undefined
        }
      : {
          command: mcpMetadata.command as string,
          args: mcpMetadata.args ? JSON.stringify(mcpMetadata.args) : undefined,
          env: mcpMetadata.env ? JSON.stringify(mcpMetadata.env) : undefined,
        }
    : undefined;

  // Fetch available tools - for MCP/Smithery use stored connection params (via mcp provider), for others use toolkit slugs
  // Note: Smithery integrations use 'mcp' as the provider for fetching tools since they connect to MCP servers
  const toolsProvider = isMCPLike ? 'mcp' : integration.provider;
  const { data: availableToolsData, isLoading: isLoadingAvailableTools } = useProviderTools(
    toolsProvider,
    {
      params: isMCPLike ? mcpToolsParams : { toolkitSlugs: toolkitSlugs.join(',') },
      enabled: isAddingTools && (isMCPLike ? !!mcpToolsParams : toolkitSlugs.length > 0),
    }
  );

  // Flatten available tools and filter out already-added ones
  const allAvailableTools: AvailableTool[] = availableToolsData?.pages?.flatMap(page => page.tools) ?? [];
  const notAddedTools = allAvailableTools.filter(tool => !addedToolSlugs.has(tool.slug));

  // Filter by search query
  const filteredAvailableTools = searchQuery
    ? notAddedTools.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : notAddedTools;

  // Get a display name - use editedName if it's been saved, otherwise integration name
  // This ensures the UI updates immediately after rename without waiting for refetch
  const displayName = editedName || integration.name;

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === integration.name) {
      setIsRenaming(false);
      setEditedName(integration.name);
      return;
    }

    setIsSavingName(true);
    try {
      await updateIntegration.mutateAsync({ name: editedName.trim() });
      toast.success('Name updated');
      setIsRenaming(false);
      onUpdated?.();
    } catch (error) {
      toast.error(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setEditedName(integration.name);
  };

  const handleDeleteTool = async (cachedToolId: string, toolName: string) => {
    setDeletingToolId(cachedToolId);
    try {
      await deleteTool.mutateAsync({ toolId: cachedToolId });
      toast.success(`Removed "${toolName}"`);
      refetchTools();
    } catch (error) {
      toast.error(`Failed to remove tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingToolId(null);
    }
  };

  const handleToggleTool = (slug: string) => {
    const newSet = new Set(selectedNewTools);
    if (newSet.has(slug)) {
      newSet.delete(slug);
    } else {
      newSet.add(slug);
    }
    setSelectedNewTools(newSet);
  };

  const handleAddTools = async () => {
    if (selectedNewTools.size === 0) return;

    setIsUpdating(true);
    try {
      // Combine current and new tool slugs
      const currentToolSlugs = integrationTools.map(t => t.toolSlug).filter(Boolean) as string[];
      const allToolSlugs = [...new Set([...currentToolSlugs, ...selectedNewTools])];

      console.log('handleAddTools - integrationTools:', integrationTools);
      console.log('handleAddTools - currentToolSlugs:', currentToolSlugs);
      console.log('handleAddTools - selectedNewTools:', Array.from(selectedNewTools));
      console.log('handleAddTools - allToolSlugs:', allToolSlugs);

      // Update the integration with new tools - this also caches the tools
      await updateIntegration.mutateAsync({
        selectedTools: allToolSlugs,
      });

      toast.success(`Added ${selectedNewTools.size} tool${selectedNewTools.size === 1 ? '' : 's'}`);
      setSelectedNewTools(new Set());
      setIsAddingTools(false);
      refetchTools();
    } catch (error) {
      toast.error(`Failed to add tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Always show "Add More Tools" button - we don't pre-fetch available tools
  // If there are no more tools, user will see "All available tools are already added" message
  const hasMoreToolsToAdd = true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface2 flex-shrink-0">
              <Wrench className="h-5 w-5 text-icon4" />
            </div>
            <div className="flex-1 min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-8 text-base font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelRename();
                    }}
                    disabled={isSavingName}
                  />
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="p-1.5 h-8 w-8"
                  >
                    {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleCancelRename}
                    disabled={isSavingName}
                    className="p-1.5 h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="truncate">{displayName}</span>
                  <button
                    onClick={() => setIsRenaming(true)}
                    className="p-1 rounded hover:bg-surface3 text-icon3 hover:text-icon6 transition-colors"
                    title="Rename"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Txt variant="ui-sm" className="text-icon3 block font-normal">
                via {integration.provider === 'mcp' ? 'MCP' : integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
              </Txt>
            </div>
          </DialogTitle>
          <DialogDescription>
            {integrationTools.length} tool{integrationTools.length === 1 ? '' : 's'} added from this {isMCPLike ? 'server' : 'toolkit'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col py-4">
          {isAddingTools ? (
            // Add tools view - shows tools from SAME toolkit that aren't added yet
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <Txt variant="ui-md" className="font-medium text-icon6">
                  Add more tools from {displayName}
                </Txt>
                <Button variant="ghost" size="md" onClick={() => { setIsAddingTools(false); setSelectedNewTools(new Set()); setSearchQuery(''); }}>
                  Cancel
                </Button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-icon3" />
                <Input
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {isLoadingAvailableTools ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-icon3" />
                    <Txt variant="ui-sm" className="text-icon3 mt-2">Loading available tools...</Txt>
                  </div>
                ) : filteredAvailableTools.length === 0 ? (
                  <div className="text-center py-8 text-icon3">
                    <Txt variant="ui-sm">
                      {searchQuery ? 'No tools match your search' : 'All available tools are already added'}
                    </Txt>
                  </div>
                ) : (
                  filteredAvailableTools.map(tool => (
                    <label
                      key={tool.slug}
                      className="flex items-center gap-3 p-3 bg-surface2 rounded-lg border border-border1 hover:border-border2 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedNewTools.has(tool.slug)}
                        onCheckedChange={() => handleToggleTool(tool.slug)}
                      />
                      <div className="flex-1 min-w-0">
                        <Txt variant="ui-sm" className="font-medium text-icon6 block">
                          {tool.name}
                        </Txt>
                        {tool.description && (
                          <Txt variant="ui-sm" className="text-icon3 truncate block">
                            {tool.description}
                          </Txt>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>

              {selectedNewTools.size > 0 && (
                <div className="mt-4 pt-4 border-t border-border1">
                  <Button
                    variant="default"
                    size="md"
                    onClick={handleAddTools}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Add {selectedNewTools.size} tool{selectedNewTools.size === 1 ? '' : 's'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Current tools view
            <div className="flex-1 flex flex-col overflow-hidden">
              {integrationTools.length === 0 ? (
                <div className="text-center py-12 text-icon3">
                  <div className="p-4 rounded-full bg-surface2 inline-block mb-4">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <Txt variant="ui-md" className="block mb-1">No tools added</Txt>
                  <Txt variant="ui-sm">Click "Add Tools" to select tools from this {isMCPLike ? 'server' : 'toolkit'}.</Txt>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                  {integrationTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="group flex items-center justify-between p-3 bg-surface2 rounded-lg border border-border1 hover:border-border2 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <Txt variant="ui-sm" className="font-medium text-icon6 truncate block">
                          {tool.name}
                        </Txt>
                        {tool.description && (
                          <Txt variant="ui-sm" className="text-icon3 truncate block">
                            {tool.description}
                          </Txt>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => handleDeleteTool(tool.cachedToolId, tool.name)}
                        disabled={deletingToolId === tool.cachedToolId}
                        className="text-icon3 hover:text-destructive1 hover:bg-destructive1/10 shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove tool"
                      >
                        {deletingToolId === tool.cachedToolId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {!isAddingTools && hasMoreToolsToAdd && (
            <Button variant="outline" onClick={() => setIsAddingTools(true)} className="mr-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add More Tools
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
