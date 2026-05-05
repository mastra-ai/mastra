import { Button, Spinner, Textarea, toast } from '@mastra/playground-ui';
import { ArrowUpIcon, GraduationCap, MessageCircleQuestion, MessagesSquare, Wrench } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { useAgentBuilderAllowedModels } from '../../hooks/use-agent-builder-allowed-models';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';

const EXAMPLES = [
  {
    title: 'Support triage',
    icon: MessagesSquare,
    prompt:
      'Build an agent that triages incoming customer support emails. Classify urgency, route to the right team, and draft a polite first reply that asks for missing details.',
  },
  {
    title: 'Standup bot',
    icon: MessageCircleQuestion,
    prompt:
      'Build an agent that runs an async Slack standup. It pings each team member in the morning, collects what they did, what they will do, and any blockers, then posts a concise summary in #standup.',
  },
  {
    title: 'PR reviewer',
    icon: Wrench,
    prompt:
      'Build an agent that reviews TypeScript pull requests on GitHub. Look for type-safety issues, missing tests, and inconsistent patterns. Leave inline review comments with concrete suggestions.',
  },
  {
    title: 'Onboarding tutor',
    icon: GraduationCap,
    prompt:
      'Build an agent that onboards new engineers to our codebase. It explains the architecture, points to the right docs, and answers questions in plain English with code examples.',
  },
];

const truncateName = (prompt: string): string =>
  prompt.length <= 20 ? prompt : prompt.slice(0, 20) + '…';

const FALLBACK_MODEL = { provider: 'google', name: 'gemini-2.5-flash' } as const;

/**
 * Picks a model the server will accept for the new agent. The starter has to
 * commit to *some* model up front (visibility/persistence happens before the
 * user reaches the configure panel), but we deliberately reuse the same
 * filtered list the picker shows so we never propose a model the admin policy
 * blocks. Users override this immediately on the next screen.
 */
const resolveStarterModel = (allowedModels: ModelInfo[]): { provider: string; name: string } => {
  const first = allowedModels[0];
  if (first) return { provider: first.provider, name: first.model };
  return FALLBACK_MODEL;
};

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { createStoredAgent } = useStoredAgentMutations(undefined);
  const defaultVisibility = useDefaultVisibility();
  const { models: allowedModels } = useAgentBuilderAllowedModels();
  const trimmed = message.trim();
  const isCreating = createStoredAgent.isPending;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (trimmed.length === 0 || isCreating) return;
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
        model: resolveStarterModel(allowedModels),
      });
    } catch {
      toast.error('Failed to start a new agent');
      return;
    }
    void navigate(`/agent-builder/agents/${id}/edit`, {
      state: { userMessage: trimmed },
      viewTransition: true,
    });
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
    <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-12">
        <h1
          className="starter-heading text-center font-serif text-neutral6"
          style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
        >
          What should we build today?
        </h1>

        <form onSubmit={handleSubmit}>
          <div
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
            <div className="flex items-center justify-end px-3 pb-2.5">
              <Button
                type="submit"
                variant="default"
                size="icon-md"
                tooltip="Start building"
                disabled={trimmed.length === 0 || isCreating}
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
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example, i) => {
            const Icon = example.icon;
            return (
              <button
                key={example.title}
                type="button"
                onClick={() => handleExampleClick(example.prompt)}
                data-testid={`agent-builder-starter-example-${example.title.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ animationDelay: `${280 + i * 40}ms` }}
                className="starter-chip group inline-flex items-center gap-2 rounded-full border border-border1 bg-transparent px-4 py-2 text-ui-sm text-neutral4 transition-colors duration-normal ease-out-custom hover:border-border2 hover:bg-surface2 hover:text-neutral6"
              >
                <Icon className="h-3.5 w-3.5 text-neutral3 transition-colors group-hover:text-neutral5" />
                {example.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
