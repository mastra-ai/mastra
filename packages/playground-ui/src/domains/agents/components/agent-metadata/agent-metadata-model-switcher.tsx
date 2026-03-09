import { useState, useEffect } from 'react';
import { Spinner } from '@/ds/components/Spinner';
import { RotateCcw } from 'lucide-react';
import { UpdateModelParams, Provider } from '@mastra/client-js';
import { useModelReset } from '../../context/model-reset-context';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId, findProviderById } from '@/domains/llm';

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

  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  const providers = dataProviders?.providers || [];

  // Update local state when default props change (e.g., after reset)
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider || '');
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);

  // Resolve the full provider ID (handles gateway prefix, e.g., 'custom' -> 'acme/custom')
  const resolvedProvider = findProviderById(providers, currentModelProvider);
  const fullProviderId = resolvedProvider?.id || currentModelProvider;

  // Auto-save when model changes
  const handleModelSelect = async (modelId: string) => {
    setSelectedModel(modelId);

    if (modelId && fullProviderId) {
      setLoading(true);
      try {
        const result = await updateModel({
          provider: fullProviderId as UpdateModelParams['provider'],
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

        // Update back to original configuration - resolve full provider ID
        const resolvedOriginalProvider = findProviderById(providers, originalProvider);
        const fullOriginalProviderId = resolvedOriginalProvider?.id || originalProvider;
        if (fullOriginalProviderId && originalModel) {
          updateModel({
            provider: fullOriginalProviderId as UpdateModelParams['provider'],
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

  const currentProvider = findProviderById(providers, currentModelProvider);

  return (
    <div className="@container">
      <div className="flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full">
        <div className="w-full @xs:w-2/5">
          <LLMProviders
            value={currentModelProvider}
            onValueChange={handleProviderSelect}
            variant="default"
            open={providerOpen}
            onOpenChange={setProviderOpen}
          />
        </div>

        <div className="w-full @xs:w-3/5">
          <LLMModels
            llmId={currentModelProvider}
            value={selectedModel}
            onValueChange={handleModelSelect}
            variant="default"
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
