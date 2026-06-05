import { Button, Spinner, Textarea, toast } from '@mastra/playground-ui';
import { useCreateWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { ArrowUpIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ExampleList } from './example-list';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

const AGENT_BUILDER_CREATION_WORKFLOW_ID = 'agent-builder-creation';

const getCreatedAgentId = (result: unknown): string | undefined => {
  if (!result || typeof result !== 'object') return undefined;
  const id = (result as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: currentUser } = useCurrentUser();
  const createWorkflowRun = useCreateWorkflowRun();
  const { streamWorkflow, streamResult, isStreaming } = useStreamWorkflow({
    debugMode: false,
    onError: error => toast.error(error.message),
  });

  const trimmed = message.trim();
  const isCreating = createWorkflowRun.isPending || isStreaming;
  const isSubmitBlocked = trimmed.length === 0 || isCreating;

  // When the creation workflow finishes successfully its terminal `persist-agent`
  // step output (createResultSchema) surfaces on `streamResult.result`. Capture
  // the created agent id so the user can choose where to go next.
  const resultId = streamResult.status === 'success' ? getCreatedAgentId(streamResult.result) : undefined;
  useEffect(() => {
    if (resultId) setCreatedAgentId(resultId);
  }, [resultId]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitBlocked) return;

    try {
      const run = await createWorkflowRun.mutateAsync({ workflowId: AGENT_BUILDER_CREATION_WORKFLOW_ID });

      // Attribute authorship to the current user so the persisted agent is owned
      // by them. The workflow reads the `user` key off the request context.
      await streamWorkflow.mutateAsync({
        workflowId: AGENT_BUILDER_CREATION_WORKFLOW_ID,
        runId: run.runId,
        inputData: { prompt: trimmed },
        requestContext: currentUser ? { user: currentUser } : {},
      });
    } catch {
      toast.error('Failed to create your agent');
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

  if (createdAgentId) {
    return (
      <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
        <div
          className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8 text-center"
          data-testid="agent-builder-starter-complete"
        >
          <h1
            className="starter-heading font-serif text-neutral6"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
          >
            Your agent is ready
          </h1>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="default"
              size="lg"
              data-testid="agent-builder-starter-view"
              onClick={() =>
                navigate(`/agent-builder/agents/${createdAgentId}/view`, {
                  viewTransition: true,
                })
              }
            >
              View agent
            </Button>
            <Button
              variant="outline"
              size="lg"
              data-testid="agent-builder-starter-review"
              onClick={() =>
                navigate(`/agent-builder/agents/${createdAgentId}/onboarding`, {
                  viewTransition: true,
                })
              }
            >
              Review config
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
