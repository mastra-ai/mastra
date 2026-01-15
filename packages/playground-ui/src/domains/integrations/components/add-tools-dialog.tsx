'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { toast } from '@/lib/toast';

import { ProviderList } from './provider-list';
import { ToolkitBrowser } from './toolkit-browser';
import { ToolSelector } from './tool-selector';
import { MCPConnectionInput } from './mcp-connection-input';
import type { MCPConnectionConfig } from './mcp-connection-input';
import { useProviders, useProviderToolkits, useProviderTools, useIntegrationMutations } from '../hooks';
import type { IntegrationProvider } from '../types';
import type { ValidateMCPResponse } from '@mastra/client-js';

/**
 * Props for the AddToolsDialog component.
 */
export interface AddToolsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to change the open state */
  onOpenChange: (open: boolean) => void;
  /** Optional callback called after successfully adding tools */
  onSuccess?: (integrationId: string) => void;
}

/**
 * Multi-step wizard dialog for adding integration tools to Mastra.
 *
 * Flow:
 * 1. Select Provider (Composio, Arcade)
 * 2. Select Toolkits from provider
 * 3. Review and deselect individual tools (all selected by default)
 * 4. Confirm and save integration
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <AddToolsDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   onSuccess={(id) => console.log(`Added integration ${id}`)}
 * />
 * ```
 */
export function AddToolsDialog({ open, onOpenChange, onSuccess }: AddToolsDialogProps) {
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [selectedToolkits, setSelectedToolkits] = useState<Set<string>>(new Set());
  const [deselectedTools, setDeselectedTools] = useState<Set<string>>(new Set());

  // MCP-specific state
  const [mcpConfig, setMcpConfig] = useState<MCPConnectionConfig | null>(null);
  const [mcpValidated, setMcpValidated] = useState(false);
  const [mcpToolCount, setMcpToolCount] = useState(0);
  const [mcpValidationError, setMcpValidationError] = useState<string | undefined>();

  // Determine if we're in MCP mode
  const isMCPProvider = selectedProvider === 'mcp';

  // Data fetching
  const { data: providersResponse, isLoading: isLoadingProviders } = useProviders();
  const {
    data: toolkitsData,
    isLoading: isLoadingToolkits,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProviderToolkits(selectedProvider || '', {
    params: {},
    enabled: !!selectedProvider && !isMCPProvider && step === 2,
  });
  // Build MCP params for tools query
  const mcpToolsParams = mcpConfig
    ? mcpConfig.transport === 'http'
      ? { url: mcpConfig.url, headers: mcpConfig.headers ? JSON.stringify(mcpConfig.headers) : undefined }
      : {
          command: mcpConfig.command,
          args: mcpConfig.args ? JSON.stringify(mcpConfig.args) : undefined,
          env: mcpConfig.env ? JSON.stringify(mcpConfig.env) : undefined,
        }
    : undefined;

  const {
    data: toolsData,
    isLoading: isLoadingTools,
    fetchNextPage: fetchNextToolsPage,
    hasNextPage: hasNextToolsPage,
    isFetchingNextPage: isFetchingNextToolsPage,
  } = useProviderTools(selectedProvider || '', {
    params: isMCPProvider
      ? mcpToolsParams
      : { toolkitSlugs: Array.from(selectedToolkits).join(',') },
    // For MCP, also require mcpConfig to be set before enabling
    enabled: !!selectedProvider && (isMCPProvider ? mcpValidated && !!mcpConfig && step === 3 : selectedToolkits.size > 0 && step === 3),
  });

  // Mutations
  const { createIntegration, validateMCPConnection } = useIntegrationMutations();

  // Extract providers list from response
  const providers = providersResponse?.providers || [];

  // Flatten paginated data
  const toolkits = toolkitsData?.pages.flatMap(page => page.toolkits) || [];
  const tools = toolsData?.pages.flatMap(page => page.tools) || [];

  // Calculate selected tools (all tools from selected toolkits minus deselected)
  // Filter out any null/undefined slugs that may come from the API
  const selectedTools = new Set(
    tools
      .filter(tool => tool.slug && !deselectedTools.has(tool.slug))
      .map(tool => tool.slug)
  );

  // MCP validation handler
  const handleMCPValidate = async (config: MCPConnectionConfig) => {
    setMcpValidationError(undefined);
    setMcpValidated(false);

    // Build validation params based on transport
    const validationParams = config.transport === 'http'
      ? { transport: 'http' as const, url: config.url!, headers: config.headers }
      : { transport: 'stdio' as const, command: config.command!, args: config.args, env: config.env };

    const result = await validateMCPConnection.mutateAsync(validationParams) as ValidateMCPResponse;

    if (!result.valid) {
      setMcpValidationError(result.error || 'Failed to connect to MCP server');
      throw new Error(result.error || 'Failed to connect to MCP server');
    }

    // Store MCP config and mark as validated
    setMcpConfig(config);
    setMcpValidated(true);
    setMcpToolCount(result.toolCount);
  };

  // Navigation handlers
  const handleNext = () => {
    if (step === 1 && selectedProvider) {
      // For MCP, we show URL input in step 1, then skip step 2 when validated
      if (isMCPProvider) {
        if (mcpValidated) {
          // Set virtual toolkit for MCP and skip to step 3
          setSelectedToolkits(new Set(['mcp-server']));
          setStep(3);
        }
        // If not validated, user needs to connect first - don't navigate
      } else {
        setStep(2);
      }
    } else if (step === 2 && selectedToolkits.size > 0) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      if (isMCPProvider) {
        // For MCP, go back to step 1 (URL input)
        setStep(1);
      } else {
        setStep(2);
      }
    }
  };

  const handleCancel = () => {
    // Reset wizard state
    setStep(1);
    setSelectedProvider(null);
    setSelectedToolkits(new Set());
    setDeselectedTools(new Set());
    // Reset MCP state
    setMcpConfig(null);
    setMcpValidated(false);
    setMcpToolCount(0);
    setMcpValidationError(undefined);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selectedProvider || selectedToolkits.size === 0) {
      return;
    }

    try {
      const integrationId = crypto.randomUUID();

      // Generate integration name based on provider and config
      let integrationName: string;
      if (isMCPProvider && mcpConfig) {
        // Use custom name if provided, otherwise generate from connection info
        if (mcpConfig.name) {
          integrationName = mcpConfig.name;
        } else if (mcpConfig.transport === 'http') {
          integrationName = `MCP: ${new URL(mcpConfig.url!).hostname}`;
        } else {
          integrationName = `MCP: ${mcpConfig.command}`;
        }
      } else {
        // For Composio/Arcade, use the toolkit name(s)
        const selectedToolkitNames = toolkits
          .filter(t => selectedToolkits.has(t.slug))
          .map(t => t.name);

        if (selectedToolkitNames.length > 0) {
          integrationName = selectedToolkitNames.join(', ');
        } else {
          // Fallback to slugs if names not available
          integrationName = Array.from(selectedToolkits).join(', ') || `${selectedProvider} Integration`;
        }
      }

      // Filter out any null/undefined values that may have been added to the Sets
      const toolkitsArray = Array.from(selectedToolkits).filter((slug): slug is string => Boolean(slug));
      const toolsArray = Array.from(selectedTools).filter((slug): slug is string => Boolean(slug));

      // Build MCP metadata based on transport type
      const mcpMetadata = isMCPProvider && mcpConfig
        ? mcpConfig.transport === 'http'
          ? {
              transport: 'http' as const,
              url: mcpConfig.url,
              headers: mcpConfig.headers,
            }
          : {
              transport: 'stdio' as const,
              command: mcpConfig.command,
              args: mcpConfig.args,
              env: mcpConfig.env,
            }
        : undefined;

      await createIntegration.mutateAsync({
        id: integrationId,
        provider: selectedProvider,
        name: integrationName,
        enabled: true,
        selectedToolkits: toolkitsArray,
        selectedTools: toolsArray,
        // Include MCP metadata if this is an MCP integration
        ...(mcpMetadata && { metadata: mcpMetadata }),
      });

      toast.success(`Successfully added ${selectedTools.size} tools from ${isMCPProvider ? 'MCP server' : selectedProvider}`);
      handleCancel(); // Reset and close
      onSuccess?.(integrationId);
    } catch (error) {
      toast.error(
        `Failed to add integration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider as IntegrationProvider);
    // Reset MCP state when changing provider
    if (provider !== 'mcp') {
      setMcpConfig(null);
      setMcpValidated(false);
      setMcpToolCount(0);
      setMcpValidationError(undefined);
    }
  };

  const handleToolkitSelectionChange = (newSelection: Set<string>) => {
    setSelectedToolkits(newSelection);
  };

  const handleToolSelectionChange = (newSelection: Set<string>) => {
    // Convert from "selected" to "deselected" - tool selector shows selected, we track deselected
    const allToolSlugs = new Set(tools.map(t => t.slug));
    const newDeselected = new Set<string>();
    for (const slug of allToolSlugs) {
      if (!newSelection.has(slug)) {
        newDeselected.add(slug);
      }
    }
    setDeselectedTools(newDeselected);
  };

  // Determine button states
  const canGoNext = step === 1
    ? (isMCPProvider ? mcpValidated : !!selectedProvider)
    : step === 2
    ? selectedToolkits.size > 0
    : false;
  const isLastStep = step === 3;

  // Get step subtitle
  const getStepSubtitle = () => {
    if (step === 1) {
      if (isMCPProvider) {
        return 'Configure MCP server connection';
      }
      return 'Select an integration provider';
    }
    if (step === 2) return `Select toolkits from ${selectedProvider}`;
    return 'Review and customize tool selection';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface1 border-border1 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Tools</DialogTitle>
          <Txt variant="ui-sm" className="text-icon6">
            {getStepSubtitle()}
          </Txt>
        </DialogHeader>

        {/* Step indicator - MCP has 2 steps (provider/URL, tools), others have 3 (provider, toolkits, tools) */}
        <div className="flex items-center gap-2 pb-4">
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 1 ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
          {!isMCPProvider && (
            <div
              className={`flex-1 h-1 rounded-full ${
                step >= 2 ? 'bg-accent1' : 'bg-surface3'
              }`}
            />
          )}
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 3 || (isMCPProvider && step >= 1 && mcpValidated) ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto min-h-[400px]">
          {step === 1 && !isMCPProvider && (
            <ProviderList
              providers={providers}
              isLoading={isLoadingProviders}
              selectedProvider={selectedProvider || undefined}
              onSelectProvider={handleProviderSelect}
            />
          )}

          {step === 1 && isMCPProvider && (
            <div className="space-y-4">
              {/* Back to provider selection */}
              <button
                type="button"
                onClick={() => setSelectedProvider(null)}
                className="text-icon5 hover:text-icon6 text-sm flex items-center gap-1"
              >
                ← Back to providers
              </button>

              <MCPConnectionInput
                onValidate={handleMCPValidate}
                isValidating={validateMCPConnection.isPending}
                validationError={mcpValidationError}
                onSuccess={(config, toolCount) => {
                  setMcpConfig(config);
                  setMcpToolCount(toolCount);
                  setMcpValidated(true);
                }}
              />

              {mcpValidated && mcpConfig && (
                <div className="bg-surface3 rounded-lg p-4 space-y-2">
                  <Txt variant="ui-sm" className="text-icon6 font-medium">
                    Connection Verified
                  </Txt>
                  <Txt variant="ui-sm" className="text-icon3">
                    Found {mcpToolCount} tool{mcpToolCount === 1 ? '' : 's'} available
                    {mcpConfig.transport === 'http' ? ` on ${mcpConfig.url}` : ` via ${mcpConfig.command}`}.
                    Click Next to review and select tools.
                  </Txt>
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedProvider && !isMCPProvider && (
            <ToolkitBrowser
              toolkits={toolkits}
              isLoading={isLoadingToolkits}
              selectedToolkits={selectedToolkits}
              onSelectionChange={handleToolkitSelectionChange}
            />
          )}

          {step === 3 && selectedProvider && (
            <ToolSelector
              tools={tools}
              isLoading={isLoadingTools}
              selectedTools={selectedTools}
              onSelectionChange={handleToolSelectionChange}
            />
          )}
        </div>

        {/* Footer with navigation */}
        <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-4 border-t border-border1">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={handleCancel}>
              Cancel
            </Button>
            {step > 1 && (
              <Button variant="outline" size="md" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 2 && selectedToolkits.size > 0 && (
              <Txt variant="ui-sm" className="text-icon6">
                {selectedToolkits.size} toolkit{selectedToolkits.size === 1 ? '' : 's'} selected
              </Txt>
            )}
            {step === 3 && (
              <Txt variant="ui-sm" className="text-icon6">
                {selectedTools.size} tool{selectedTools.size === 1 ? '' : 's'} selected
              </Txt>
            )}

            {!isLastStep ? (
              <Button
                variant="default"
                size="md"
                onClick={handleNext}
                disabled={!canGoNext}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="default"
                size="md"
                onClick={handleConfirm}
                disabled={selectedTools.size === 0 || createIntegration.isPending}
              >
                {createIntegration.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${selectedTools.size} Tool${selectedTools.size === 1 ? '' : 's'}`
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
