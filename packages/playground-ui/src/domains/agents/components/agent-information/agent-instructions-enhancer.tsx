import { useState, useRef, useCallback } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

import { githubDarkInit } from '@uiw/codemirror-theme-github';
import { useAgentPromptExperiment } from '../../context';
import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { RefreshCcwIcon, ChevronDown } from 'lucide-react';
import { usePromptEnhancer } from '../../hooks/use-prompt-enhancer';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { useAgent } from '../../hooks/use-agent';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { cleanProviderId } from '../agent-metadata/utils';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useAllModels, ModelInfo } from '../model-picker/use-model-picker';

export const PromptEnhancer = ({ agentId }: { agentId: string }) => {
  const { isDirty, prompt, setPrompt, resetPrompt } = useAgentPromptExperiment();

  return (
    <div className="space-y-4">
      {isDirty && (
        <Alert variant="info">
          <AlertTitle as="h5">Experiment mode</AlertTitle>
          <AlertDescription as="p">
            You're editing this agent's instructions. Changes are saved locally in your browser but won't update the
            agent's code.
          </AlertDescription>

          <Button variant="light" onClick={resetPrompt}>
            <Icon>
              <RefreshCcwIcon />
            </Icon>
            Reset
          </Button>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="rounded-md bg-[#1a1a1a] p-1 font-mono">
          <CodeMirror
            value={prompt}
            editable={true}
            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping]}
            onChange={setPrompt}
            theme={githubDarkInit({
              settings: {
                caret: '#c6c6c6',
                fontFamily: 'monospace',
                background: 'transparent',
                gutterBackground: 'transparent',
                gutterForeground: '#939393',
                gutterBorder: 'none',
              },
            })}
          />
        </div>

        <PromptEnhancerTextarea agentId={agentId} />
      </div>
    </div>
  );
};

interface EnhancerModelSelectorProps {
  selectedModel: { provider: string; modelId: string } | null;
  onModelSelect: (model: { provider: string; modelId: string } | null) => void;
  connectedModels: ModelInfo[];
  disabled?: boolean;
}

const EnhancerModelSelector = ({
  selectedModel,
  onModelSelect,
  connectedModels,
  disabled,
}: EnhancerModelSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredModels = connectedModels.filter(
    m =>
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.providerName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = useCallback(
    (model: ModelInfo | null) => {
      if (model) {
        onModelSelect({ provider: model.provider, modelId: model.model });
      } else {
        onModelSelect(null);
      }
      setIsOpen(false);
      setSearch('');
    },
    [onModelSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => Math.min(prev + 1, filteredModels.length));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex === 0) {
            handleSelect(null);
          } else if (highlightedIndex <= filteredModels.length) {
            handleSelect(filteredModels[highlightedIndex - 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, filteredModels, highlightedIndex, handleSelect],
  );

  const displayValue = selectedModel ? `${selectedModel.provider}/${selectedModel.modelId}` : 'Default (agent model)';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs text-icon4 hover:text-icon5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selectedModel && <ProviderLogo providerId={selectedModel.provider} size={12} />}
          <span className="truncate max-w-[180px]">{displayValue}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] max-h-[300px] overflow-y-auto p-2"
        onOpenAutoFocus={e => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Input
          ref={inputRef}
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search models..."
          className="mb-2"
        />
        <div className="space-y-0.5">
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-surface5 text-sm ${
              highlightedIndex === 0 ? 'bg-surface5' : ''
            } ${!selectedModel ? 'text-accent1' : ''}`}
            onClick={() => handleSelect(null)}
          >
            Default (agent model)
          </div>
          {filteredModels.map((model, index) => {
            const isHighlighted = index + 1 === highlightedIndex;
            const isSelected = selectedModel?.provider === model.provider && selectedModel?.modelId === model.model;
            return (
              <div
                key={`${model.provider}-${model.model}`}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-surface5 text-sm ${
                  isHighlighted ? 'bg-surface5' : ''
                } ${isSelected ? 'text-accent1' : ''}`}
                onClick={() => handleSelect(model)}
              >
                <ProviderLogo providerId={model.provider} size={14} />
                <span className="truncate">{model.model}</span>
              </div>
            );
          })}
          {filteredModels.length === 0 && search && <div className="text-xs text-icon3 px-3 py-2">No models found</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const PromptEnhancerTextarea = ({ agentId }: { agentId: string }) => {
  const { prompt, setPrompt } = useAgentPromptExperiment();
  const { mutateAsync: enhancePrompt, isPending } = usePromptEnhancer({ agentId });
  const { data: agent, isLoading: isAgentLoading, isError: isAgentError } = useAgent(agentId);
  const { data: providersData, isLoading: isProvidersLoading } = useAgentsModelProviders();
  const [selectedModel, setSelectedModel] = useState<{ provider: string; modelId: string } | null>(null);

  const providers = providersData?.providers || [];
  const allModels = useAllModels(providers);

  // Get only models from connected providers
  const connectedModels = allModels.filter(m => {
    const cleanId = cleanProviderId(m.provider);
    const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
    return provider?.connected === true;
  });

  // Check if a provider has an API key configured
  const isProviderConnected = (providerId: string) => {
    const cleanId = cleanProviderId(providerId);
    const provider = providers.find(p => cleanProviderId(p.id) === cleanId);
    return provider?.connected === true;
  };

  // Check if ANY enabled model has a connected provider
  const hasConnectedModel = () => {
    if (agent?.modelList && agent.modelList.length > 0) {
      return agent.modelList.some(m => m.enabled !== false && isProviderConnected(m.model.provider));
    }
    return agent?.provider ? isProviderConnected(agent.provider) : false;
  };

  const isDataLoading = isAgentLoading || isProvidersLoading;
  // If agent fetch errored (e.g., all models disabled), treat as no valid model
  // But if user selected a custom model, we can still proceed
  const hasValidModel = !isDataLoading && (selectedModel || (!isAgentError && hasConnectedModel()));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const userComment = formData.get('userComment') as string;
    try {
      const result = await enhancePrompt({
        instructions: prompt,
        userComment,
        model: selectedModel || undefined,
      });
      form.reset();
      setPrompt(result.new_prompt);
    } catch {
      // Error is already handled by the hook with toast
    }
  };

  const isDisabled = isPending || !hasValidModel;
  const showWarning = !isDataLoading && !selectedModel && !hasConnectedModel();

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        name="userComment"
        placeholder="Enter your comment here..."
        className="resize-none"
        disabled={isDisabled}
      />

      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-icon3">Model:</span>
          <EnhancerModelSelector
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            connectedModels={connectedModels}
            disabled={isPending || isDataLoading}
          />
        </div>
        <div className="flex items-center gap-2">
          {showWarning && <span className="text-xs text-yellow-200">No model with a configured API key found.</span>}
          <Button variant="light" type="submit" disabled={isDisabled}>
            <Icon>{isPending ? <Spinner /> : <RefreshCcwIcon />}</Icon>
            Enhance prompt
          </Button>
        </div>
      </div>
    </form>
  );
};
