import { Button, Spinner, Textarea, toast } from '@mastra/playground-ui';
import { useCreateWorkflowRun, useStreamWorkflow } from '@mastra/react';
import { ArrowUpIcon, CheckIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AgentCreationInProgress } from './agent-creation-in-progress';
import { ExampleList } from './example-list';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

const AGENT_BUILDER_CREATION_WORKFLOW_ID = 'agent-builder-creation';

const getCreatedAgentId = (result: unknown): string | undefined => {
  if (!result || typeof result !== 'object') return undefined;
  const id = (result as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
};

/**
 * The terminal `persist-agent` step output is `createResultSchema`
 * ({ id, config: { name, description, ... } }). Pull the resolved name and
 * description so the completion view can welcome the user to their agent.
 */
const getCreatedAgentSummary = (result: unknown): { name?: string; description?: string } => {
  if (!result || typeof result !== 'object') return {};
  const config = (result as { config?: unknown }).config;
  if (!config || typeof config !== 'object') return {};
  const { name, description } = config as { name?: unknown; description?: unknown };
  return {
    name: typeof name === 'string' && name.trim().length > 0 ? name : undefined,
    description: typeof description === 'string' && description.trim().length > 0 ? description : undefined,
  };
};

type CreationPhase = 'initial' | 'creating';

export const AgentBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<CreationPhase>('initial');
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{ name?: string; description?: string }>({});
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: currentUser } = useCurrentUser();
  const createWorkflowRun = useCreateWorkflowRun();
  const { streamWorkflow, streamResult } = useStreamWorkflow({
    debugMode: false,
    onError: error => toast.error(error.message),
  });

  const trimmed = message.trim();
  // `phase` tracks that a run is in flight (from submit until it resolves or
  // fails): it disables the composer and shows the submit spinner. We never flip
  // back to the composer on a transient pending flag, so a finished stream can't
  // strand the user before the result is captured.
  const isCreating = phase === 'creating';
  // The running-state timeline is shown only once the workflow is *actually*
  // streaming. The run goes `submit → createWorkflowRun → stream start`; the
  // `workflow-start` chunk sets `status: 'running'`, which is the first moment
  // real per-step data exists. Until then we keep the composer (with its submit
  // spinner) up rather than flashing an all-gray timeline. We also keep the
  // timeline up through `success` until the created agent id is captured (the
  // effect below runs a tick later), so the composer never flashes between the
  // last step completing and the complete view appearing.
  const isStreaming = isCreating && (streamResult.status === 'running' || streamResult.status === 'success');
  const isSubmitBlocked = trimmed.length === 0 || isCreating;

  // When the creation workflow finishes successfully its terminal `persist-agent`
  // step output (createResultSchema) surfaces on `streamResult.result`. Capture
  // the created agent id so the user can choose where to go next.
  const successResult = streamResult.status === 'success' ? streamResult.result : undefined;
  const resultId = getCreatedAgentId(successResult);
  const resultSummary = getCreatedAgentSummary(successResult);
  useEffect(() => {
    if (resultId) {
      setCreatedAgentId(resultId);
      setCreatedAgent(resultSummary);
    }
    // `resultId` is the stable signal that a successful result is captured; the
    // summary is derived from the same result object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultId]);

  // A run that terminates as failed surfaces an error toast via `onError`; bring
  // the user back to the composer so they can retry rather than stranding them
  // on the timeline.
  useEffect(() => {
    if (streamResult.status === 'failed') setPhase('initial');
  }, [streamResult.status]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitBlocked) return;

    // Enter the running state up front so the timeline takes over immediately and
    // stays put for the whole run, regardless of stream/mutation timing.
    setPhase('creating');
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
      // The run could not start (or streaming threw): return to the composer so
      // the user can retry, and surface the failure.
      setPhase('initial');
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
    const agentName = createdAgent.name;
    const headline = agentName ? `Welcome to ${agentName}` : 'Your agent is ready';
    const description =
      createdAgent.description ??
      'Your new agent has been created and saved. Open it to start a conversation, or review its configuration to fine-tune the details.';
    return (
      <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
        <div
          className="starter-complete relative z-10 flex w-full max-w-xl flex-col items-center gap-6 text-center"
          data-testid="agent-builder-starter-complete"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent1Dark shadow-glow-accent1">
            <CheckIcon className="h-7 w-7 text-white" />
          </span>

          <div className="flex flex-col gap-3">
            <h1
              className="font-serif text-neutral6"
              style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
            >
              {headline}
            </h1>
            <p
              className="mx-auto max-w-md text-ui-lg text-neutral4"
              data-testid="agent-builder-starter-complete-description"
            >
              {description}
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
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

  if (isStreaming) {
    return <AgentCreationInProgress steps={streamResult.steps ?? {}} />;
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
