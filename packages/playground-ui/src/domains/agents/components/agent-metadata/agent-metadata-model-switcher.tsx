import { Input } from '@/components/ui/input';
import { anthropicModels, googleModels, groqModels, openaiModels, xAIModels } from './models';
import { useState } from 'react';
import { providerMapToIcon } from '../provider-map-icon';
import { Icon } from '@/ds/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CircleCheck } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpdateModelParams } from '@mastra/client-js';

export interface AgentMetadataModelSwitcherProps {
  defaultProvider: string;
  defaultModel: string;
  updateModel: (newModel: UpdateModelParams) => Promise<{ message: string }>;
  closeEditor: () => void;
  modelProviders: string[];
}

const Models = {
  openai: {
    models: openaiModels?.map(model => ({ provider: 'openai', model, icon: 'openai.chat' })),
    icon: 'openai.chat',
  },
  anthropic: {
    models: anthropicModels?.map(model => ({ provider: 'anthropic', model, icon: 'anthropic.chat' })),
    icon: 'anthropic.chat',
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
}: AgentMetadataModelSwitcherProps) => {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [selectedProvider, setSelectedProvider] = useState(() => {
    if (defaultProvider) {
      const providerOnly = defaultProvider.split('.')[0];
      return providerOnly;
    }

    return '';
  });
  const [loading, setLoading] = useState(false);

  const modelsList = Object.entries(Models).filter(([provider]) => modelProviders.includes(provider));

  const allModels = modelsList.flatMap(([_, { models }]) => models);

  const providersList = modelsList.map(([provider, { icon }]) => ({ provider, icon }));

  const model = allModels.find(model => model.model === selectedModel);

  const handleSave = async () => {
    setLoading(true);
    const providerToUse = model?.provider ?? selectedProvider;
    await updateModel({ provider: providerToUse as UpdateModelParams['provider'], modelId: selectedModel });
    setLoading(false);
    closeEditor();
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Select
          value={model?.provider ?? selectedProvider}
          onValueChange={setSelectedProvider}
          disabled={!!model?.provider}
        >
          <SelectTrigger className="max-w-[150px]">
            <SelectValue placeholder="Select provider" />
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
        <Input
          id="model-input"
          list="model-suggestions"
          type="text"
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          placeholder="Enter model name or select from suggestions..."
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleSave} className="text-icon3 hover:text-icon6">
              <Icon>{loading ? <Spinner /> : <CircleCheck />}</Icon>
            </button>
          </TooltipTrigger>
          <TooltipContent>{loading ? 'Saving...' : 'Save new model'}</TooltipContent>
        </Tooltip>
      </div>

      <datalist id="model-suggestions">
        {allModels.map(model => (
          <option key={model.provider + model.model} value={model.model}>
            <Icon>{providerMapToIcon[model.icon as keyof typeof providerMapToIcon]}</Icon>
            {model.model}
          </option>
        ))}
      </datalist>
    </TooltipProvider>
  );
};
