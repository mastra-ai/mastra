'use client';

import * as React from 'react';
import { RefreshCcwIcon, Sparkles, ChevronDown } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Input } from '@/ds/components/Input';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';

import { usePromptEnhancer } from '../../hooks/use-prompt-enhancer';
import { useAgent } from '../../hooks/use-agent';
import { useAgentsModelProviders } from '../../hooks/use-agents-model-providers';
import { cleanProviderId } from '../agent-metadata/utils';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { useAllModels, ModelInfo } from '../model-picker/use-model-picker';

interface EnhancerModelSelectorProps {
  selectedModel: { provider: string; modelId: string } | null;
  onModelSelect: (model: { provider: string; modelId: string } | null) => void;
  connectedModels: ModelInfo[];
  disabled?: boolean;
  /** When true, hides the "Default (agent model)" option since there's no agent yet */
  isCreateMode?: boolean;
}

const EnhancerModelSelector = ({
  selectedModel,
  onModelSelect,
  connectedModels,
  disabled,
  isCreateMode = false,
}: EnhancerModelSelectorProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredModels = connectedModels.filter(
    m =>
      m.model.toLowerCase().includes(search.toLowerCase()) ||
      m.providerName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = React.useCallback(
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

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      // In create mode, index 0 is the first model. In edit mode, index 0 is "Default"
      const maxIndex = isCreateMode ? filteredModels.length - 1 : filteredModels.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => Math.min(prev + 1, maxIndex));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (isCreateMode) {
            // In create mode, index maps directly to filteredModels
            if (highlightedIndex < filteredModels.length) {
              handleSelect(filteredModels[highlightedIndex]);
            }
          } else {
            // In edit mode, index 0 is "Default", then models start at 1
            if (highlightedIndex === 0) {
              handleSelect(null);
            } else if (highlightedIndex <= filteredModels.length) {
              handleSelect(filteredModels[highlightedIndex - 1]);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, filteredModels, highlightedIndex, handleSelect, isCreateMode],
  );

  const displayValue = selectedModel
    ? `${selectedModel.provider}/${selectedModel.modelId}`
    : isCreateMode
      ? 'Select a model'
      : 'Default (agent model)';

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
        className="w-[280px] p-2"
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
        <div className="max-h-[250px] overflow-y-auto space-y-0.5">
          {/* Only show "Default" option in edit mode */}
          {!isCreateMode && (
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-surface5 text-sm ${
                highlightedIndex === 0 ? 'bg-surface5' : ''
              } ${!selectedModel ? 'text-accent1' : ''}`}
              onClick={() => handleSelect(null)}
            >
              Default (agent model)
            </div>
          )}
          {filteredModels.map((model, index) => {
            // In create mode, index maps directly. In edit mode, offset by 1 for "Default" option
            const isHighlighted = isCreateMode ? index === highlightedIndex : index + 1 === highlightedIndex;
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

/** Context type for the prompt enhancer - determines the enhancement strategy */
export type EnhancerContext = 'agent' | 'scorer';

/** Variable info for displaying available template variables */
export interface TemplateVariable {
  name: string;
  description?: string;
}

export interface InstructionsEnhancerProps {
  /** Current instructions value */
  value: string;
  /** Callback when instructions change */
  onChange: (value: string) => void;
  /** Agent ID - if provided, can use agent's default model; otherwise requires model selection */
  agentId?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Context for enhancement - determines what kind of prompt is being enhanced */
  context?: EnhancerContext;
  /** Available template variables to display as hints */
  variables?: TemplateVariable[];
  /** Number of rows for the textarea */
  rows?: number;
  /** Custom CSS class for the textarea */
  textareaClassName?: string;
  /** Placeholder for the enhance comment input */
  enhanceCommentPlaceholder?: string;
  /** Default model to use for enhancement (used in scorer context) */
  defaultModel?: { provider: string; name: string };
}

/**
 * Instructions textarea with AI-powered enhance functionality.
 * In edit mode (agentId provided), can use the agent's default model.
 * In create mode (no agentId), requires explicit model selection.
 * Supports different contexts (agent instructions, scorer prompts) with context-appropriate enhancement.
 */
export function InstructionsEnhancer({
  value,
  onChange,
  agentId,
  placeholder = 'Enter agent instructions',
  error,
  disabled = false,
  context = 'agent',
  variables,
  rows = 6,
  textareaClassName,
  enhanceCommentPlaceholder = 'Describe how to improve the instructions...',
  defaultModel,
}: InstructionsEnhancerProps) {
  const [enhanceComment, setEnhanceComment] = React.useState('');
  const [showEnhanceInput, setShowEnhanceInput] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<{ provider: string; modelId: string } | null>(
    defaultModel ? { provider: defaultModel.provider, modelId: defaultModel.name } : null,
  );

  const isCreateMode = !agentId;

  // Fetch data - agent data only needed in edit mode, providers always needed
  const { mutateAsync: enhancePrompt, isPending } = usePromptEnhancer({ agentId, context });
  const { data: agent, isLoading: isAgentLoading, isError: isAgentError } = useAgent(agentId);
  const { data: providersData, isLoading: isProvidersLoading } = useAgentsModelProviders();

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

  // Check if ANY enabled model has a connected provider (edit mode only)
  const hasConnectedModel = () => {
    if (!agent) return false;
    if (agent.modelList && agent.modelList.length > 0) {
      return agent.modelList.some(m => m.enabled !== false && isProviderConnected(m.model.provider));
    }
    return agent.provider ? isProviderConnected(agent.provider) : false;
  };

  // In create mode, only check if providers are loading. In edit mode, also check agent loading.
  const isDataLoading = isCreateMode ? isProvidersLoading : isAgentLoading || isProvidersLoading;

  // In create mode: need a selected model. In edit mode: need selected model OR agent's default model.
  const hasValidModel = isCreateMode
    ? !isDataLoading && !!selectedModel
    : !isDataLoading && (selectedModel || (!isAgentError && hasConnectedModel()));

  // Can enhance if we have a valid model (and in create mode, a model must be explicitly selected)
  const canEnhance = hasValidModel;

  // Show warning when no valid model is available
  const showEnhanceWarning = isCreateMode
    ? !isDataLoading && !selectedModel && connectedModels.length === 0
    : !isDataLoading && !selectedModel && !hasConnectedModel();

  // In create mode, show a message prompting to select a model (different from warning about no connected models)
  const showSelectModelPrompt = isCreateMode && !isDataLoading && !selectedModel && connectedModels.length > 0;

  const handleEnhance = async () => {
    if (!canEnhance) return;

    try {
      const result = await enhancePrompt({
        instructions: value,
        userComment: enhanceComment,
        model: selectedModel || undefined,
      });
      onChange(result.new_prompt);
      setEnhanceComment('');
      setShowEnhanceInput(false);
    } catch {
      // Error is already handled by the hook with toast
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && showEnhanceInput) {
      e.preventDefault();
      handleEnhance();
    }
    if (e.key === 'Escape') {
      setShowEnhanceInput(false);
      setEnhanceComment('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled || isPending}
        className={cn(
          'flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors',
          'border-sm border-border1 placeholder:text-icon3',
          'px-[13px] py-2 text-[calc(13_/_16_*_1rem)] resize-y min-h-[120px]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-accent2',
          textareaClassName,
        )}
      />

      {error && <span className="text-xs text-accent2">{error}</span>}

      {/* Template variables hint */}
      {variables && variables.length > 0 && (
        <p className="text-xs text-icon4">
          Template variables:{' '}
          {variables.map((v, i) => (
            <React.Fragment key={v.name}>
              <code className="text-icon5">{`{{${v.name}}}`}</code>
              {i < variables.length - 1 && ', '}
            </React.Fragment>
          ))}
        </p>
      )}

      {/* Enhance UI - available in both create and edit modes */}
      <div className="flex flex-col gap-2">
        {showEnhanceInput ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2" onKeyDown={handleKeyDown}>
              <Input
                value={enhanceComment}
                onChange={e => setEnhanceComment(e.target.value)}
                placeholder={enhanceCommentPlaceholder}
                disabled={isPending || !canEnhance}
                className="flex-1"
                autoFocus
              />
              <Button type="button" variant="light" onClick={handleEnhance} disabled={isPending || !canEnhance}>
                <Icon>{isPending ? <Spinner /> : <RefreshCcwIcon />}</Icon>
                Enhance
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEnhanceInput(false);
                  setEnhanceComment('');
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-icon3">Model:</span>
                <EnhancerModelSelector
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  connectedModels={connectedModels}
                  disabled={isPending || isDataLoading}
                  isCreateMode={isCreateMode}
                />
              </div>
              {showEnhanceWarning && (
                <span className="text-xs text-yellow-200">No model with a configured API key found.</span>
              )}
              {showSelectModelPrompt && <span className="text-xs text-icon3">Please select a model to enhance.</span>}
            </div>
          </div>
        ) : (
          <div className="flex justify-end items-center gap-2">
            {showEnhanceWarning && (
              <span className="text-xs text-yellow-200">No model with a configured API key found.</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setShowEnhanceInput(true)}
              className="text-icon3 hover:text-icon5"
            >
              <Icon>
                <Sparkles className="h-3 w-3" />
              </Icon>
              Enhance with AI
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
