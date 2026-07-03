import { Button } from '@mastra/playground-ui/components/Button';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ArrowUpIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA } from '../../constants/default-request-context-schema';
import { useAgentBuilderAllowedModels } from '../../hooks/use-agent-builder-allowed-models';
import { useBuilderModelPolicy, useBuilderSettings } from '../../hooks/use-builder-settings';
import { ExampleList } from './example-list';
import { resolveStarterModel, truncateName } from './utils';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { ProviderLogo } from '@/domains/llm/components/provider-logo';
import { providerMatches } from '@/domains/llm/hooks/use-filtered-models';

const providersMatch = (provider: string, targetProvider: string) =>
  providerMatches(provider, targetProvider) || providerMatches(targetProvider, provider);

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<string>();
  const [selectedModelId, setSelectedModelId] = useState<string>();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { createStoredAgent } = useStoredAgentMutations(undefined);
  const defaultVisibility = useDefaultVisibility();
  const { data: authCapabilities } = useAuthCapabilities();
  const {
    desktopModelStatus,
    isLoading: isAllowedModelsLoading,
    models: allowedModels,
    providers: allowedProviders,
  } = useAgentBuilderAllowedModels();
  const modelPolicy = useBuilderModelPolicy();
  // While builder settings are still loading, useBuilderModelPolicy falls back
  // to an inactive policy — submitting in that window would skip the admin
  // default model. Block submit until the settings query has resolved.
  const { isLoading: isBuilderSettingsLoading } = useBuilderSettings();

  const trimmed = message.trim();
  const isCreating = createStoredAgent.isPending;
  const isDesktopModelUnavailable = desktopModelStatus?.unavailable === true;
  const starterModel = resolveStarterModel(allowedModels, modelPolicy);
  const selectedProvider =
    selectedProviderId ??
    allowedProviders.find(provider => providersMatch(provider.id, starterModel.provider))?.id ??
    starterModel.provider;
  const selectedProviderModels = useMemo(
    () => allowedModels.filter(model => providersMatch(model.provider, selectedProvider)),
    [allowedModels, selectedProvider],
  );
  const selectedModel =
    selectedModelId ??
    selectedProviderModels.find(model => model.model === starterModel.name)?.model ??
    selectedProviderModels[0]?.model ??
    starterModel.name;
  const providerOptions = useMemo<ComboboxOption[]>(
    () =>
      allowedProviders.map(provider => ({
        label: provider.name,
        value: provider.id,
        start: <ProviderLogo providerId={provider.id} size={16} />,
      })),
    [allowedProviders],
  );
  const modelOptions = useMemo<ComboboxOption[]>(
    () =>
      selectedProviderModels.map(model => ({
        label: model.model,
        value: model.model,
      })),
    [selectedProviderModels],
  );
  const showModelPicker = !isAllowedModelsLoading && providerOptions.length > 0;
  const isSubmitBlocked =
    trimmed.length === 0 ||
    isCreating ||
    isBuilderSettingsLoading ||
    isAllowedModelsLoading ||
    isDesktopModelUnavailable;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitBlocked) return;

    const id = nanoid();

    try {
      await createStoredAgent.mutateAsync({
        id,
        name: truncateName(trimmed),
        instructions: '',
        tools: {},
        agents: {},
        workflows: {},
        skills: {},
        visibility: defaultVisibility,
        model: { provider: selectedProvider, name: selectedModel },
        ...(authCapabilities?.enabled ? { requestContextSchema: DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA } : {}),
      });

      void navigate(`/agent-builder/agents/${id}/edit`, {
        state: { userMessage: trimmed },
        viewTransition: true,
      });
    } catch {
      toast.error('Failed to start a new agent');
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCreating) return;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleExampleClick = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  const handleProviderChange = (providerId: string) => {
    const firstModel = allowedModels.find(model => providersMatch(model.provider, providerId));
    setSelectedProviderId(providerId);
    setSelectedModelId(firstModel?.model);
  };

  return (
    <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-12">
        <h1
          className="starter-heading text-center font-serif text-neutral6"
          style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
        >
          What should we build today?
        </h1>

        <form
          onSubmit={handleSubmit}
          className="starter-prompt rounded-2xl border border-border1 bg-surface2 transition-colors duration-normal ease-out-custom focus-within:border-neutral3"
          style={{ viewTransitionName: 'chat-composer' }}
        >
          <Textarea
            ref={textareaRef}
            testId="agent-builder-starter-input"
            size="default"
            variant="unstyled"
            placeholder="Describe the agent you want to build…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCreating}
            className="min-h-[112px] resize-none px-5 py-4 text-ui-md outline-none placeholder:text-neutral3 focus:outline-none focus-visible:outline-none"
            rows={3}
          />

          <div className="flex flex-col gap-2 px-3 pb-2.5 sm:flex-row sm:items-center sm:justify-between">
            {showModelPicker ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <Combobox
                  options={providerOptions}
                  value={selectedProvider}
                  onValueChange={handleProviderChange}
                  placeholder="Select provider..."
                  searchPlaceholder="Search providers..."
                  emptyText="No providers found"
                  variant="ghost"
                  size="sm"
                  className="min-w-0 sm:max-w-48"
                />
                <Combobox
                  options={modelOptions}
                  value={selectedModel}
                  onValueChange={setSelectedModelId}
                  placeholder="Select model..."
                  searchPlaceholder="Search models..."
                  emptyText="No models found"
                  variant="ghost"
                  size="sm"
                  className="min-w-0 sm:max-w-64"
                />
              </div>
            ) : (
              <div />
            )}
            <Button
              type="submit"
              variant="default"
              size="icon-md"
              tooltip="Start building"
              disabled={isSubmitBlocked}
              data-testid="agent-builder-starter-submit"
              className="rounded-full"
            >
              {isCreating ? (
                <span data-testid="agent-builder-starter-submit-spinner">
                  <Spinner />
                </span>
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </div>
        </form>

        {isDesktopModelUnavailable ? (
          <div className="flex flex-col items-center gap-3 text-center text-ui-sm text-neutral4">
            <span className="font-medium text-neutral6">Local model unavailable</span>
            <span>
              Start {desktopModelStatus.providerName ?? 'your local model server'}, refresh models in Settings, then try
              again.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/settings')}>
              Open Settings
            </Button>
          </div>
        ) : null}

        <ExampleList onExampleClick={handleExampleClick} />
      </div>
    </div>
  );
};
