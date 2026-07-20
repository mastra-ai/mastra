import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ArrowUpIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA } from '../../constants/default-request-context-schema';
import { useAgentBuilderAllowedModels } from '../../hooks/use-agent-builder-allowed-models';
import { useBuilderModelPolicy, useBuilderSettings } from '../../hooks/use-builder-settings';
import { ExampleList } from './example-list';
import { resolveStarterModel, truncateName } from './utils';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { createStoredAgent } = useStoredAgentMutations(undefined);
  const defaultVisibility = useDefaultVisibility();
  const { data: authCapabilities } = useAuthCapabilities();
  const { models: allowedModels } = useAgentBuilderAllowedModels();
  const modelPolicy = useBuilderModelPolicy();
  // While builder settings are still loading, useBuilderModelPolicy falls back
  // to an inactive policy — submitting in that window would skip the admin
  // default model. Block submit until the settings query has resolved.
  const { isLoading: isBuilderSettingsLoading } = useBuilderSettings();

  const trimmed = message.trim();
  const isCreating = createStoredAgent.isPending;
  const isSubmitBlocked = trimmed.length === 0 || isCreating || isBuilderSettingsLoading;

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
        model: resolveStarterModel(allowedModels, modelPolicy),
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

  return (
    <div className="starter-aurora bg-surface1 flex min-h-full flex-col items-center justify-center px-6 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-12">
        <h1
          className="starter-heading text-neutral6 text-center font-serif"
          style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
        >
          What should we build today?
        </h1>

        <form
          onSubmit={handleSubmit}
          className="starter-prompt border-border1 bg-surface2 duration-normal ease-out-custom focus-within:border-neutral3 rounded-2xl border transition-colors"
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
            className="text-ui-md placeholder:text-neutral3 min-h-[112px] resize-none px-5 py-4 outline-none focus:outline-none focus-visible:outline-none"
            rows={3}
          />

          <div className="flex items-center justify-end px-3 pb-2.5">
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

        <ExampleList onExampleClick={handleExampleClick} />
      </div>
    </div>
  );
};
