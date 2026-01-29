import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '@/ds/components/Alert';
import { LLMProviderModelPicker, cleanProviderId } from '@/domains/llm';

export interface ModelPickerProps {
  value: { provider: string; name: string };
  onChange: (value: { provider: string; name: string }) => void;
  error?: string;
}

export const ModelPicker = ({ value, onChange, error }: ModelPickerProps) => {
  const [provider, setProvider] = useState(value.provider);
  const [model, setModel] = useState(value.name);

  // Sync state when value prop changes
  useEffect(() => {
    setProvider(value.provider);
    setModel(value.name);
  }, [value.provider, value.name]);

  const handleProviderChange = useCallback(
    (providerId: string) => {
      const cleanedProvider = cleanProviderId(providerId);
      setProvider(cleanedProvider);

      // Clear model when switching providers
      if (cleanedProvider !== cleanProviderId(provider)) {
        setModel('');
        onChange({ provider: cleanedProvider, name: '' });
      }
    },
    [provider, onChange],
  );

  const handleModelChange = useCallback(
    (selected: { provider: string; modelId: string }) => {
      setModel(selected.modelId);
      onChange({ provider: selected.provider, name: selected.modelId });
    },
    [onChange],
  );

  return (
    <>
      <LLMProviderModelPicker
        provider={provider}
        model={model}
        onProviderChange={handleProviderChange}
        onModelChange={handleModelChange}
        layout="horizontal"
        variant="default"
        size="md"
        warningVariant="alert"
        showDocLink={true}
        showStatusIndicator={true}
      />

      {error && (
        <div className="pt-2 p-2">
          <Alert variant="destructive">
            <AlertDescription as="p">{error}</AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};
