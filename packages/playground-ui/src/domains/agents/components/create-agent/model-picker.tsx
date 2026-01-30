import { useState } from 'react';
import { Alert, AlertDescription } from '@/ds/components/Alert';
import { Provider } from '@mastra/client-js';
import { LLMProviders, LLMModels, useLLMProviders, cleanProviderId } from '@/domains/llm';
import { ProviderNotConnectedAlert } from '../model-picker/provider-not-connected-alert';

export interface ModelPickerProps {
  value: { provider: string; name: string };
  onChange: (value: { provider: string; name: string }) => void;
  error?: string;
  container?: HTMLElement | ShadowRoot | null | React.RefObject<HTMLElement | ShadowRoot | null>;
}

export const ModelPicker = ({ value, onChange, error, container }: ModelPickerProps) => {
  const [modelOpen, setModelOpen] = useState(false);
  const { data: dataProviders, isLoading: providersLoading } = useLLMProviders();

  const providers = dataProviders?.providers || [];
  const currentModelProvider = cleanProviderId(value.provider);
  const currentProvider = providers.find((p: Provider) => p.id === currentModelProvider);

  const handleProviderSelect = (providerId: string) => {
    const cleanedProvider = cleanProviderId(providerId);

    // Clear model when switching providers
    if (cleanedProvider !== currentModelProvider) {
      onChange({ provider: cleanedProvider, name: '' });
    }

    // Auto-open model selector when provider is connected
    const selectedProvider = providers.find((p: Provider) => p.id === cleanedProvider);
    if (selectedProvider?.connected) {
      setModelOpen(true);
    }
  };

  const handleModelSelect = (modelId: string) => {
    const providerToUse = currentModelProvider || value.provider;
    if (modelId && providerToUse) {
      onChange({ provider: providerToUse, name: modelId });
    }
  };

  if (providersLoading) {
    return null;
  }

  return (
    <div className="@container">
      <div className="flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full">
        <div className="w-full @xs:w-2/5">
          <LLMProviders
            value={value.provider}
            onValueChange={handleProviderSelect}
            variant="light"
            container={container}
          />
        </div>

        <div className="w-full @xs:w-3/5">
          <LLMModels
            llmId={currentModelProvider}
            value={value.name}
            onValueChange={handleModelSelect}
            variant="light"
            open={modelOpen}
            onOpenChange={setModelOpen}
            container={container}
          />
        </div>
      </div>

      {currentProvider && <ProviderNotConnectedAlert provider={currentProvider} />}

      {error && (
        <div className="pt-2 p-2">
          <Alert variant="destructive">
            <AlertDescription as="p">{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};
