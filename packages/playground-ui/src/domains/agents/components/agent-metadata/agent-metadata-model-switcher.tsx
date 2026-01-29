import { useState, useEffect, useCallback } from 'react';
import { Provider, UpdateModelParams } from '@mastra/client-js';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { useModelReset } from '../../context/model-reset-context';
import {
  LLMProviderPicker,
  LLMModelPicker,
  ProviderWarning,
  useLLMProviders,
  useAllModels,
  cleanProviderId,
  findProvider,
} from '@/domains/llm';

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

  const { data: dataProviders } = useLLMProviders();
  const providers = dataProviders?.providers || [];

  // Update local state when default props change (e.g., after reset)
  useEffect(() => {
    setSelectedModel(defaultModel);
    setSelectedProvider(defaultProvider || '');
  }, [defaultModel, defaultProvider]);

  const currentModelProvider = cleanProviderId(selectedProvider);
  const currentProvider = findProvider(providers, selectedProvider);

  // Handle provider selection
  const handleProviderSelect = useCallback(
    (providerId: string) => {
      const cleanedId = cleanProviderId(providerId);
      setSelectedProvider(cleanedId);

      // Only clear model selection and open model combobox when switching to a different provider
      if (cleanedId !== currentModelProvider) {
        setSelectedModel('');
        setModelOpen(true);
      }
    },
    [currentModelProvider],
  );

  // Auto-save when model changes
  const handleModelSelect = useCallback(
    async (selected: { provider: string; modelId: string }) => {
      setSelectedModel(selected.modelId);

      const providerToUse = currentModelProvider || selectedProvider;

      if (selected.modelId && providerToUse) {
        setLoading(true);
        try {
          const result = await updateModel({
            provider: providerToUse as UpdateModelParams['provider'],
            modelId: selected.modelId,
          });
          console.log('Model updated:', result);
        } catch (error) {
          console.error('Failed to update model:', error);
        } finally {
          setLoading(false);
        }
      }
    },
    [currentModelProvider, selectedProvider, updateModel],
  );

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

  // Handle reset button click - resets to the ORIGINAL model
  const handleReset = useCallback(async () => {
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
  }, [resetModel]);

  // Need to use controlled open state to track when pickers are open
  const handleProviderOpenChange = useCallback((open: boolean) => {
    setProviderOpen(open);
  }, []);

  const handleModelOpenChange = useCallback((open: boolean) => {
    setModelOpen(open);
  }, []);

  return (
    <div className="@container">
      <div className="flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full">
        <div className="w-full @xs:w-2/5">
          <LLMProviderModelPickerProvider
            providers={providers}
            value={currentModelProvider}
            onValueChange={handleProviderSelect}
            variant="default"
            size="md"
            open={providerOpen}
            onOpenChange={handleProviderOpenChange}
          />
        </div>

        <div className="w-full @xs:w-3/5">
          <LLMProviderModelPickerModel
            providers={providers}
            provider={currentModelProvider}
            value={selectedModel}
            onValueChange={handleModelSelect}
            variant="default"
            size="md"
            open={modelOpen}
            onOpenChange={handleModelOpenChange}
          />
        </div>

        <ResetButton
          onReset={handleReset}
          loading={loading}
          disabled={!resetModel}
        />
      </div>

      <ProviderWarningSection provider={currentProvider} />
    </div>
  );
};

// Internal components to simplify the main component

interface ResetButtonProps {
  onReset: () => Promise<void>;
  loading: boolean;
  disabled: boolean;
}

const ResetButton = ({ onReset, loading, disabled }: ResetButtonProps) => (
  <Button
    variant="light"
    size="md"
    onClick={onReset}
    disabled={loading || disabled}
    className="flex items-center gap-1.5 text-xs whitespace-nowrap !border-0"
    title="Reset to original model"
  >
    {loading ? <Spinner className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
  </Button>
);

interface LLMProviderModelPickerProviderProps {
  providers: Provider[];
  value: string;
  onValueChange: (providerId: string) => void;
  variant: 'default' | 'light' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LLMProviderModelPickerProvider = ({
  providers,
  value,
  onValueChange,
  variant,
  size,
  open,
  onOpenChange,
}: LLMProviderModelPickerProviderProps) => (
  <LLMProviderPicker
    providers={providers}
    value={value}
    onValueChange={onValueChange}
    placeholder="Select provider..."
    searchPlaceholder="Search providers..."
    emptyText="No providers found"
    variant={variant}
    size={size}
    open={open}
    onOpenChange={onOpenChange}
  />
);

interface LLMProviderModelPickerModelProps {
  providers: Provider[];
  provider: string;
  value: string;
  onValueChange: (selected: { provider: string; modelId: string }) => void;
  variant: 'default' | 'light' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LLMProviderModelPickerModel = ({
  providers,
  provider,
  value,
  onValueChange,
  variant,
  size,
  open,
  onOpenChange,
}: LLMProviderModelPickerModelProps) => {
  const allModels = useAllModels(providers);

  const handleModelChange = (modelId: string) => {
    onValueChange({ provider, modelId });
  };

  return (
    <LLMModelPicker
      models={allModels}
      provider={provider}
      value={value}
      onValueChange={handleModelChange}
      placeholder="Select model..."
      searchPlaceholder="Search or enter custom model..."
      emptyText="No models found"
      variant={variant}
      size={size}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
};

interface ProviderWarningSectionProps {
  provider: Provider | undefined;
}

const ProviderWarningSection = ({ provider }: ProviderWarningSectionProps) => (
  <ProviderWarning provider={provider} variant="alert" />
);
