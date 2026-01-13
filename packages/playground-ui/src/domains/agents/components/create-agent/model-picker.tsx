import { useRef, useCallback } from 'react';
import Spinner from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/ds/components/Alert';
import { cleanProviderId } from '../agent-metadata/utils';
import { Provider } from '@mastra/client-js';
import {
  ProviderSelect,
  ModelSelect,
  ModelSelectHandle,
  ProviderNotConnectedAlert,
  useModelPickerData,
} from '../model-picker';

export interface ModelPickerProps {
  value: { provider: string; name: string };
  onChange: (value: { provider: string; name: string }) => void;
  error?: string;
}

export const ModelPicker = ({ value, onChange, error }: ModelPickerProps) => {
  const modelSelectRef = useRef<ModelSelectHandle>(null);
  const providerInputRef = useRef<HTMLInputElement>(null);

  const { providers, providersLoading, allModels, currentModelProvider, currentProvider } = useModelPickerData(
    value.provider,
  );

  const handleProviderSelect = useCallback(
    (provider: Provider) => {
      const cleanedProvider = cleanProviderId(provider.id);

      // Clear model when switching providers
      if (provider.id !== currentModelProvider) {
        onChange({ provider: cleanedProvider, name: '' });
      }

      // Auto-focus model input if provider is connected
      if (provider.connected) {
        setTimeout(() => {
          modelSelectRef.current?.focus();
        }, 100);
      }
    },
    [currentModelProvider, onChange],
  );

  const handleModelSelect = useCallback(
    (modelId: string) => {
      const providerToUse = currentModelProvider || value.provider;
      if (modelId && providerToUse) {
        onChange({ provider: providerToUse, name: modelId });
      }
    },
    [currentModelProvider, value.provider, onChange],
  );

  const handleShiftTab = useCallback(() => {
    providerInputRef.current?.focus();
  }, []);

  if (providersLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner />
        <span className="text-sm text-gray-500">Loading providers...</span>
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="flex flex-col @xs:flex-row items-stretch @xs:items-center gap-2 w-full">
        <ProviderSelect providers={providers} selectedProvider={value.provider} onSelect={handleProviderSelect} />

        <ModelSelect
          ref={modelSelectRef}
          allModels={allModels}
          currentProvider={currentModelProvider}
          selectedModel={value.name}
          onSelect={handleModelSelect}
          onShiftTab={handleShiftTab}
        />
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
