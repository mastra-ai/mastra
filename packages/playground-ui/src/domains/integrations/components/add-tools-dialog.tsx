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
import { useProviders, useProviderToolkits, useProviderTools, useIntegrationMutations } from '../hooks';
import type { IntegrationProvider } from '../types';

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
    enabled: !!selectedProvider && step === 2,
  });
  const {
    data: toolsData,
    isLoading: isLoadingTools,
    fetchNextPage: fetchNextToolsPage,
    hasNextPage: hasNextToolsPage,
    isFetchingNextPage: isFetchingNextToolsPage,
  } = useProviderTools(selectedProvider || '', {
    params: { toolkitSlugs: Array.from(selectedToolkits).join(',') },
    enabled: !!selectedProvider && selectedToolkits.size > 0 && step === 3,
  });

  // Mutations
  const { createIntegration } = useIntegrationMutations();

  // Extract providers list from response
  const providers = providersResponse?.providers || [];

  // Flatten paginated data
  const toolkits = toolkitsData?.pages.flatMap(page => page.toolkits) || [];
  const tools = toolsData?.pages.flatMap(page => page.tools) || [];

  // Calculate selected tools (all tools from selected toolkits minus deselected)
  const selectedTools = new Set(tools.filter(tool => !deselectedTools.has(tool.slug)).map(tool => tool.slug));

  // Navigation handlers
  const handleNext = () => {
    if (step === 1 && selectedProvider) {
      setStep(2);
    } else if (step === 2 && selectedToolkits.size > 0) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  const handleCancel = () => {
    // Reset wizard state
    setStep(1);
    setSelectedProvider(null);
    setSelectedToolkits(new Set());
    setDeselectedTools(new Set());
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selectedProvider || selectedToolkits.size === 0) {
      return;
    }

    try {
      const integrationId = crypto.randomUUID();
      const integrationName = `${selectedProvider}-${Date.now()}`;

      await createIntegration.mutateAsync({
        id: integrationId,
        provider: selectedProvider,
        name: integrationName,
        enabled: true,
        selectedToolkits: Array.from(selectedToolkits),
        selectedTools: Array.from(selectedTools),
      });

      toast.success(`Successfully added ${selectedTools.size} tools from ${selectedProvider}`);
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
  const canGoNext = step === 1 ? !!selectedProvider : step === 2 ? selectedToolkits.size > 0 : false;
  const isLastStep = step === 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface1 border-border1 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Tools</DialogTitle>
          <Txt variant="ui-sm" className="text-icon6">
            {step === 1 && 'Select an integration provider'}
            {step === 2 && `Select toolkits from ${selectedProvider}`}
            {step === 3 && 'Review and customize tool selection'}
          </Txt>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 pb-4">
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 1 ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 2 ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
          <div
            className={`flex-1 h-1 rounded-full ${
              step >= 3 ? 'bg-accent1' : 'bg-surface3'
            }`}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto min-h-[400px]">
          {step === 1 && (
            <ProviderList
              providers={providers}
              isLoading={isLoadingProviders}
              selectedProvider={selectedProvider || undefined}
              onSelectProvider={handleProviderSelect}
            />
          )}

          {step === 2 && selectedProvider && (
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
