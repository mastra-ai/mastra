'use client';

import { useState } from 'react';
import { Trash2, Loader2, RefreshCw, ChevronRight, Wrench } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { useIntegrationMutations } from '../hooks';
import type { IntegrationConfig } from '@mastra/client-js';

/**
 * Props for the IntegrationCard component.
 */
export interface IntegrationCardProps {
  /** Integration configuration */
  integration: IntegrationConfig;
  /** Callback when integration is deleted */
  onDeleted?: () => void;
  /** Callback when integration is clicked for editing */
  onEdit?: (integration: IntegrationConfig) => void;
}

/**
 * Card component displaying an integration with management actions.
 */
export function IntegrationCard({ integration, onDeleted, onEdit }: IntegrationCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { deleteIntegration, refreshTools } = useIntegrationMutations(integration.id);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteIntegration.mutateAsync();
      toast.success('Integration deleted successfully');
      setIsDeleteOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(`Failed to delete integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      const result = await refreshTools.mutateAsync();
      toast.success(`Refreshed ${result.toolsUpdated} tools`);
    } catch (error) {
      toast.error(`Failed to refresh tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const toolCount = integration.toolCount ?? integration.selectedTools?.length ?? 0;

  // Use integration name directly - users can rename via edit dialog
  const displayName = integration.name;

  const handleCardClick = () => {
    if (onEdit) {
      onEdit(integration);
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border1 bg-surface1 transition-all duration-200",
        onEdit && "cursor-pointer hover:border-accent1/50 hover:shadow-lg hover:shadow-accent1/5"
      )}
      onClick={handleCardClick}
    >
      <div className="p-4">
        {/* Top row: Icon + Name + Badge */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface3 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-icon4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Txt variant="ui-md" className="font-semibold text-icon6 truncate">
                {displayName}
              </Txt>
              <Badge variant="default" className="flex-shrink-0 text-xs">
                {integration.provider === 'mcp' ? 'MCP' : integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bottom row: Tool count + Actions */}
        <div className="flex items-center justify-between">
          <Txt variant="ui-sm" className="text-icon3">
            {toolCount} tool{toolCount === 1 ? '' : 's'}
          </Txt>

          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="md"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-icon3 hover:text-icon6 hover:bg-surface3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              title="Refresh tools"
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <AlertDialog.Trigger asChild>
                <Button
                  variant="ghost"
                  size="md"
                  className="text-icon3 hover:text-destructive1 hover:bg-destructive1/10 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete integration"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Delete Integration</AlertDialog.Title>
                  <AlertDialog.Description>
                    Are you sure you want to delete "{displayName}"? This will remove all {toolCount} tools. This action cannot be undone.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive1 hover:bg-destructive1/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog>

            {onEdit && (
              <ChevronRight className="h-4 w-4 text-icon2 group-hover:text-icon4 transition-colors ml-1" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
