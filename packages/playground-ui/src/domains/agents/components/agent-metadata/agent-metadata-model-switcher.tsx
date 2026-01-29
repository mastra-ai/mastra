import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@/ds/components/Spinner';
import { Info, RotateCcw } from 'lucide-react';
import { ProviderLogo } from './provider-logo';
import { UpdateModelParams } from '@mastra/client-js';
import { useModelReset } from '../../context/model-reset-context';
import { cleanProviderId } from './utils';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { Combobox, ComboboxOption } from '@/ds/components/Combobox';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  resetModel?: () => Promise<{ message: string }>;
  closeEditor?: () => void;
  autoSave?: boolean;
  selectProviderPlaceholder?: string;
}

export const AgentMetadataModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  resetModel,
}: AgentMetadataModelSwitcherProps) => {
  const [originalProvider] = useState(defaultProvider);
  const [originalModel] = useState(defaultModel);

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider || '');
  const [loading, setLoading] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const { data: dataProviders, isLoading: providersLoading } = useAgentsModelProviders();

  const providers = dataProviders?.providers || [];

  // Update local state when default props change (e.g., after reset)
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider || '');
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Get all models with their provider info
  const allModels = useMemo(() => {
    return providers.flatMap(provider =>
      provider.models.map(model => ({
        provider: provider.id,
        providerName: provider.name,
        model: model,
      })),
    );
  }, [providers]);

  // Filter and sort providers based on connection status and popularity
  const sortedProviders = useMemo(() => {
    // Define popular providers in order
    const popularProviders = ['openai', 'anthropic', 'google', 'openrouter', 'netlify'];

    const getPopularityIndex = (providerId: string) => {
      const cleanId = providerId.toLowerCase().split('.')[0];
      const index = popularProviders.indexOf(cleanId);
      return index === -1 ? popularProviders.length : index;
    };

    // Sort by: 1) connection status, 2) popularity, 3) alphabetically
    return [...providers].sort((a, b) => {
      // First, sort by connection status - connected providers first
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;

      // Then by popularity
      const aPopularity = getPopularityIndex(a.id);
      const bPopularity = getPopularityIndex(b.id);
      if (aPopularity !== bPopularity) {
        return aPopularity - bPopularity;
      }

      // Finally, alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [providers]);

  // Create provider options with icons
  const providerOptions: ComboboxOption[] = useMemo(() => {
    return sortedProviders.map(provider => ({
      label: provider.name,
      value: provider.id,
      start: (
        <div className="relative">
          <ProviderLogo providerId={provider.id} size={16} />
          <div
            className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
              provider.connected ? 'bg-accent1' : 'bg-accent2'
            }`}
            title={provider.connected ? 'Connected' : 'Not connected'}
          />
        </div>
      ),
      end: provider.docUrl ? (
        <Info
          className="w-4 h-4 text-gray-500 hover:text-gray-700 cursor-pointer"
          onClick={e => {
            e.stopPropagation();
            window.open(provider.docUrl, '_blank', 'noopener,noreferrer');
          }}
        />
      ) : null,
    }));
  }, [sortedProviders]);

  // Filter models based on selected provider
  const filteredModels = useMemo(() => {
    if (!currentModelProvider) return [];
    return allModels.filter(m => m.provider === currentModelProvider).sort((a, b) => a.model.localeCompare(b.model));
  }, [allModels, currentModelProvider]);

  // Create model options
  const modelOptions: ComboboxOption[] = useMemo(() => {
    return filteredModels.map(m => ({
      label: m.model,
      value: m.model,
    }));
  }, [filteredModels]);

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    const providerToUse = currentModelProvider || selectedProvider;

    if (modelId && providerToUse) {
      setLoading(true);
      try {
        const result = await updateModel({
          provider: providerToUse as UpdateModelParams['provider'],
          modelId,
        });
        console.log('Model updated:', result);
      } catch (error) {
        console.error('Failed to update model:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    const cleanedId = cleanProviderId(providerId);
    setSelectedProvider(cleanedId);

    // Only clear model selection and open model combobox when switching to a different provider
    if (cleanedId !== currentModelProvider) {
      setSelectedModel('');
      setModelOpen(true);
    }
  };

  // Get the model reset context
  const { registerResetFn } = useModelReset();

  // Register reset callback with context
  useEffect(() => {
    const resetIfIncomplete = () => {
      // Don't reset if either picker is currently open
      if (providerOpen || modelOpen) {
        return;
      }

      // Check if provider changed but no model selected
      const providerChanged = currentModelProvider && currentModelProvider !== originalProvider;
      const modelEmpty = !selectedModel || selectedModel === '';

      if (providerChanged && modelEmpty) {
        // Reset to original values
        setSelectedProvider(cleanProviderId(originalProvider));
        setSelectedModel(originalModel);

        // Update back to original configuration
        if (originalProvider && originalModel) {
          updateModel({
            provider: originalProvider as UpdateModelParams['provider'],
            modelId: originalModel,
          }).catch(error => {
            console.error('Failed to reset model:', error);
          });
        }
      }
    };

    registerResetFn(resetIfIncomplete);

    // Cleanup on unmount
    return () => {
      registerResetFn(null);
    };
  }, [
    registerResetFn,
    currentModelProvider,
    selectedModel,
    originalProvider,
    originalModel,
    updateModel,
    providerOpen,
    modelOpen,
  ]);

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm text-gray-500">Loading providers...</span>
      </div>
    );
  }

  // Handle reset button click - resets to the ORIGINAL model
  const handleReset = async () => {
    if (!resetModel) {
      console.warn('Reset model function not provided');
      return;
    }

    // Call the reset endpoint to restore the original model
    try {
      setLoading(true);
      await resetModel();
      // After reset, the agent will be re-fetched with the original model
      // which will update the defaultProvider and defaultModel props
    } catch (error) {
      console.error('Failed to reset model:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentProvider = providers.find(p => p.id === currentModelProvider);

  return (
    <div className="@container">
      <div className="flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full">
        <div className="w-full @xs:w-2/5">
          <Combobox
            options={providerOptions}
            value={currentModelProvider}
            onValueChange={handleProviderSelect}
            placeholder="Select provider..."
            searchPlaceholder="Search providers..."
            emptyText="No providers found"
            variant="default"
            size="md"
            open={providerOpen}
            onOpenChange={setProviderOpen}
          />
        </div>

        <div className="w-full @xs:w-3/5">
          <Combobox
            options={modelOptions}
            value={selectedModel}
            onValueChange={handleModelSelect}
            placeholder="Select model..."
            searchPlaceholder="Search or enter custom model..."
            emptyText="No models found"
            variant="default"
            size="md"
            open={modelOpen}
            onOpenChange={setModelOpen}
          />
        </div>

        <Button
          variant="light"
          size="md"
          onClick={handleReset}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs whitespace-nowrap !border-0"
          title="Reset to original model"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Show warning if selected provider is not connected */}
      {currentProvider && !currentProvider.connected && (
        <div className="pt-2 p-2">
          <Alert variant="warning">
            <AlertTitle as="h5">Provider not connected</AlertTitle>
            <AlertDescription as="p">
              Set the{' '}
              <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
                {Array.isArray(currentProvider.envVar) ? currentProvider.envVar.join(', ') : currentProvider.envVar}
              </code>{' '}
              environment{' '}
              {Array.isArray(currentProvider.envVar) && currentProvider.envVar.length > 1 ? 'variables' : 'variable'} to
              use this provider.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};
