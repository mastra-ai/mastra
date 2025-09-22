import { Input } from '@/components/ui/input';
import { anthropicModels, googleModels, groqModels, openaiModels, xAIModels } from './models';
import { useEffect, useState } from 'react';
import { providerMapToIcon } from '../provider-map-icon';
import { Icon } from '@/ds/icons';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpdateModelParams } from '@mastra/client-js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  closeEditor: () => void;
  modelProviders: string[];
  autoSave?: boolean;
  selectProviderPlaceholder?: string;
}

const Models = {
  openai: {
    models: openaiModels?.map(model => ({ provider: 'openai', model, icon: 'openai.chat' })),
    icon: 'openai.chat',
  },
  anthropic: {
    models: anthropicModels?.map(model => ({ provider: 'anthropic', model, icon: 'anthropic.messages' })),
    icon: 'anthropic.messages',
  },
  google: {
    models: googleModels?.map(model => ({ provider: 'google', model, icon: 'GOOGLE' })),
    icon: 'GOOGLE',
  },
  xAi: {
    models: xAIModels?.map(model => ({ provider: 'xai', model, icon: 'X_GROK' })),
    icon: 'X_GROK',
  },
  groq: {
    models: groqModels?.map(model => ({ provider: 'groq', model, icon: 'GROQ' })),
    icon: 'GROQ',
  },
};

export const AgentMetadataModelSwitcher = ({
  defaultProvider,
  defaultModel,
  updateModel,
  closeEditor,
  modelProviders,
  autoSave = false,
  selectProviderPlaceholder = 'Select provider',
}: AgentMetadataModelSwitcherProps) => {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(() => {
    if (defaultProvider) {
      const providerOnly = defaultProvider.split('.')[0];
      return providerOnly;
    }

    return '';
  });
  const [loading, setLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  const modelsList = Object.entries(Models).filter(([provider]) => modelProviders.includes(provider));

  const allModels = modelsList.flatMap(([_, { models }]) => models);

  const providersList = modelsList.map(([provider, { icon }]) => ({ provider, icon }));

  const model = allModels.find(model => model.model === selectedModel);

  useEffect(() => {
    const isValidModel = allModels.some(model => model.model === selectedModel);

    if (selectedModel && !isValidModel) {
      setInfoMsg('Model not in suggestions—make sure the name is correct.');
    } else {
      setInfoMsg('');
    }
  }, [selectedModel, allModels]);

  const handleSave = async () => {
    setLoading(true);
    const providerToUse = model?.provider ?? selectedProvider;
    await updateModel({ provider: providerToUse as UpdateModelParams['provider'], modelId: selectedModel });
    setLoading(false);
    closeEditor();
  };

  const filteredModels = allModels.filter(model => {
    if (selectedProvider) {
      return model.model.includes(selectedModel) && model.provider === selectedProvider;
    }
    return model.model.includes(selectedModel);
  });

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel('');
    if (autoSave) {
      updateModel({
        provider: provider as UpdateModelParams['provider'],
        modelId: '',
      });
    }
  };

  const handleModelInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setShowSuggestions(false);

    const isValidModel = allModels.some(model => model.model === e.target.value);

    if (!isValidModel) {
      if (autoSave) {
        updateModel({
          provider: selectedProvider as UpdateModelParams['provider'],
          modelId: e.target.value,
        });
      }
    }
  };

  const handleModelClick = (model: { model: string; provider: string }) => {
    setSelectedModel(model.model);

    const isValidModel = allModels.some(m => m.model === model.model);

    if (isValidModel) {
      setSelectedProvider(model.provider);
    }

    if (autoSave) {
      updateModel({
        provider: model.provider as UpdateModelParams['provider'],
        modelId: model.model,
      });
    }
    setShowSuggestions(false);
  };

  return (
    <div>
      <div className="grid xl:grid-cols-[auto_1fr_auto] items-center gap-2">
        <Select value={selectedProvider} onValueChange={handleProviderChange} disabled={!!model?.provider}>
          <SelectTrigger>
            <SelectValue placeholder={selectProviderPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {providersList.map(provider => (
              <SelectItem key={provider.provider} value={provider.provider}>
                <div className="flex items-center gap-2">
                  <Icon>{providerMapToIcon[provider.icon as keyof typeof providerMapToIcon]}</Icon>
                  {provider.provider}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={showSuggestions}>
          <PopoverTrigger asChild>
            <Input
              id="model-input"
              list="model-suggestions"
              className="flex-1 w-full h-[2.25rem] rounded-md min-w-[12rem]"
              type="text"
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
              }}
              onFocus={() => setShowSuggestions(showSuggestions => !showSuggestions)}
              onBlur={handleModelInputBlur}
              placeholder="Enter model name or select from suggestions..."
              autoComplete="off"
            />
          </PopoverTrigger>

          {filteredModels.length > 0 && (
            <PopoverContent
              onOpenAutoFocus={e => e.preventDefault()}
              className="flex flex-col  w-[var(--radix-popover-trigger-width)] max-h-[calc(var(--radix-popover-content-available-height)-50px)] overflow-y-auto"
            >
              {filteredModels.map(model => (
                <button
                  className="flex items-center justify-start gap-2 cursor-pointer hover:bg-surface5 p-2 text-[0.875rem]"
                  key={model.provider + model.model}
                  onClick={() => handleModelClick(model)}
                >
                  {model.model}
                </button>
              ))}
            </PopoverContent>
          )}
        </Popover>

        {!autoSave && (
          <Button
            onClick={handleSave}
            variant="secondary"
            size="sm"
            disabled={loading || !selectedModel}
            className="w-full"
          >
            <Icon>{loading ? <Spinner /> : 'Save'}</Icon>
          </Button>
        )}
      </div>

      {infoMsg && (
        <div
          className={cn(
            'text-[0.75rem] text-icon3 flex gap-[.5rem] mt-[0.5rem]',
            '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-7 [&>svg]:flex-shrink-0 [&>svg]:mt-[0.1rem]',
          )}
        >
          <InfoIcon /> {infoMsg}
        </div>
      )}
    </div>
  );
};
