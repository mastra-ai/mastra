import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card } from '@mastra/playground-ui/components/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageFactory } from '@mastra/react';
import type {
  MastraDBMessageMetadata,
  MessageRenderers,
  MessageStatusRenderers,
  DynamicToolPart,
  ToolInvocationPart,
  RequireApprovalEntry,
} from '@mastra/react';
import {
  AlertTriangle,
  AlignLeft,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Wrench,
  Zap,
  GlobeLockIcon,
  Building,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import type { MessageMetadata } from '../../../../lib/ai-ui/messages/message-metadata';
import { MessageText } from '../../../../lib/ai-ui/messages/renderers/message-text';
import {
  WarningStatusRenderer,
  TripwireStatusRenderer,
} from '../../../../lib/ai-ui/messages/renderers/status-renderers';
import { useAgentPrimitives } from '../../contexts/agent-primitives-context';
import { useStreamApproval, useStreamRetry } from '../../contexts/stream-chat-context';
import { useAvailableAgentTools } from '../../hooks/use-available-agent-tools';
import { parseStreamErrorText } from './parse-stream-error';
import type { ParsedStreamError } from './parse-stream-error';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import {
  SET_AGENT_BROWSER_ENABLED_TOOL_NAME,
  SET_AGENT_DESCRIPTION_TOOL_NAME,
  SET_AGENT_INSTRUCTIONS_TOOL_NAME,
  SET_AGENT_MODEL_TOOL_NAME,
  SET_AGENT_NAME_TOOL_NAME,
  SET_AGENT_SKILLS_TOOL_NAME,
  SET_AGENT_TOOLS_TOOL_NAME,
  SET_AGENT_WORKSPACE_ID_TOOL_NAME,
} from '@/domains/agent-builder/services/tool-constants';
import { ProviderLogo } from '@/domains/llm';
import { ReasoningStreamingLine } from '@/lib/ai-ui/messages/reasoning-streaming-line';
import { SignalBadge } from '@/lib/ai-ui/messages/signal-badge';
import { getSignalType, isSignalData, isUserSignalType, toReactiveSignalData } from '@/lib/ai-ui/messages/signal-data';

interface MessageRowProps {
  message: MastraDBMessage;
}

type RequireApprovalMetadata = NonNullable<MastraDBMessageMetadata['requireApprovalMetadata']>;

const ToolApprovalPrompt = ({ toolCallId, toolName }: { toolCallId: string; toolName: string }) => {
  const { approveToolCall, declineToolCall } = useStreamApproval();
  const [pending, setPending] = useState<'approve' | 'decline' | null>(null);
  const decided = pending !== null;

  const handleApprove = () => {
    setPending('approve');
    approveToolCall(toolCallId);
  };

  const handleDecline = () => {
    setPending('decline');
    declineToolCall(toolCallId);
  };

  return (
    <ToolCard testId="agent-builder-chat-tool-approval" className="bg-surface4 border-transparent">
      <Txt variant="ui-sm" className="text-neutral5 pb-2" as="div">
        Approval required for <span className="font-mono text-neutral6">{toolName}</span>
      </Txt>
      <div className="flex gap-2 items-center">
        <Button
          variant="default"
          onClick={handleApprove}
          disabled={decided}
          data-testid="agent-builder-chat-tool-approve"
          aria-label={`Approve ${toolName}`}
        >
          <Icon>{pending === 'approve' ? <Loader2 className="animate-spin" /> : <Check />}</Icon>
          Approve
        </Button>
        <Button
          variant="ghost"
          onClick={handleDecline}
          disabled={decided}
          data-testid="agent-builder-chat-tool-decline"
          aria-label={`Decline ${toolName}`}
        >
          {pending === 'decline' && (
            <Icon>
              <Loader2 className="animate-spin" />
            </Icon>
          )}
          Decline
        </Button>
      </div>
    </ToolCard>
  );
};

const getMessageDisplayRole = (message: MastraDBMessage): MastraDBMessage['role'] | null => {
  if (message.role === 'assistant' || message.role === 'user' || message.role === 'system') return message.role;
  if (message.role === 'signal') return isUserSignalType(getSignalType(message)) ? 'user' : 'assistant';
  return null;
};

/**
 * Convert a persisted reactive (non-user) `signal` row into an assistant message
 * carrying a single `data-signal` part, so the `SignalBadge` renderer shows it
 * on read-back. Restores 1.41.0 behavior lost in the chat renderer rewrite
 * (PR #17774).
 */
const toReactiveSignalMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const data = toReactiveSignalData(message);
  if (!isSignalData(data)) return null;
  return {
    ...message,
    role: 'assistant',
    content: {
      ...message.content,
      parts: [{ type: 'data-signal', data }],
    },
  } as MastraDBMessage;
};

const getRequireApprovalMetadata = (message: MastraDBMessage): RequireApprovalMetadata | undefined => {
  const metadata = message.content.metadata as MastraDBMessageMetadata | undefined;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const { mode } = metadata;
  if (mode !== 'stream' && mode !== 'network' && mode !== 'generate') return undefined;
  return metadata.requireApprovalMetadata;
};

const getNameFromInput = (input: unknown): string => {
  if (!input || typeof input !== 'object' || !('name' in input)) return 'unknown';
  return typeof input.name === 'string' ? input.name : 'unknown';
};

const findApprovalEntry = (
  approvals: RequireApprovalMetadata | undefined,
  toolName: string | undefined,
  toolCallId: string | undefined,
): RequireApprovalEntry | undefined => {
  if (!approvals) return undefined;
  return (toolName ? approvals[toolName] : undefined) ?? (toolCallId ? approvals[toolCallId] : undefined);
};

/**
 * Normalize the stored message role for display. The `signal`+`type:'user'`
 * case is mapped to `role: 'user'` so it renders as a user message. Returns
 * `null` when the message has no displayable role.
 */
const toDisplayMessage = (message: MastraDBMessage): MastraDBMessage | null => {
  const displayRole = getMessageDisplayRole(message);
  if (displayRole === null) return null;
  if (message.role === 'signal' && displayRole === 'assistant') return toReactiveSignalMessage(message);
  if (displayRole === message.role) return message;
  return { ...message, role: displayRole };
};

/**
 * Shared agent-builder tool-card dispatch for both the legacy `tool-invocation`
 * slot and the runtime `dynamic-tool` / `tool-${string}` slot.
 */
const renderToolCard = (toolName: string, input: unknown, output: unknown): ReactNode => {
  switch (toolName) {
    case SET_AGENT_NAME_TOOL_NAME:
      return <MessageSetAgentName />;
    case SET_AGENT_DESCRIPTION_TOOL_NAME:
      return <MessageSetAgentDescription />;
    case SET_AGENT_INSTRUCTIONS_TOOL_NAME:
      return <MessageSetAgentInstructions />;
    case SET_AGENT_TOOLS_TOOL_NAME:
      return <MessageSetAgentTools />;
    case SET_AGENT_SKILLS_TOOL_NAME:
      return <MessageSetAgentSkills />;
    case SET_AGENT_MODEL_TOOL_NAME:
      return <MessageSetAgentModel />;
    case SET_AGENT_BROWSER_ENABLED_TOOL_NAME:
      return <MessageSetAgentBrowserEnabled />;
    case SET_AGENT_WORKSPACE_ID_TOOL_NAME:
      return <MessageSetAgentWorkspaceId />;
    case 'skill':
      return <SkillTool name={getNameFromInput(input)} />;
    default:
      return <GenericTool toolName={toolName} input={input} output={output} />;
  }
};

export const MessageRow = ({ message }: MessageRowProps) => {
  const approvals = getRequireApprovalMetadata(message);
  const retry = useStreamRetry();
  const displayRole = getMessageDisplayRole(message);

  const dbMessage = toDisplayMessage(message);
  if (dbMessage === null) return null;

  const metadata = message.content.metadata as MessageMetadata | undefined;

  const renderers: MessageRenderers = {
    Text: part => <Txtmessage txt={part.text ?? ''} role={displayRole} metadata={metadata} />,
    Reasoning: part => {
      const state = 'state' in part ? part.state : undefined;
      if (state !== 'streaming') return null;
      return <ReasoningStreamingLine text="Reasoning..." />;
    },
    Data: part => (part.type === 'data-signal' && isSignalData(part.data) ? <SignalBadge signal={part.data} /> : null),
    ToolInvocation: (part: ToolInvocationPart) => {
      const inv = part.toolInvocation;
      const entry = findApprovalEntry(approvals, inv.toolName, inv.toolCallId);
      if (entry && inv.state !== 'result') {
        return <ToolApprovalPrompt toolCallId={entry.toolCallId} toolName={entry.toolName} />;
      }
      if (inv.state !== 'result') return null;
      const input = 'args' in inv ? inv.args : undefined;
      const output = 'result' in inv ? inv.result : undefined;
      return renderToolCard(inv.toolName, input, output);
    },
    DynamicTool: (part: DynamicToolPart) => {
      const toolName = part.toolName ?? part.type.replace(/^tool-/, '');
      const entry = findApprovalEntry(approvals, toolName, part.toolCallId);
      if (entry && part.state !== 'output-available') {
        return <ToolApprovalPrompt toolCallId={entry.toolCallId} toolName={entry.toolName} />;
      }
      if (part.state !== 'output-available') return null;
      return renderToolCard(toolName, part.input, part.output);
    },
  };

  const status: MessageStatusRenderers = {
    Error: ({ text }) => <ErrorMessage error={parseStreamErrorText(text)} onRetry={retry} />,
    Warning: WarningStatusRenderer,
    Tripwire: TripwireStatusRenderer,
  };

  return <MessageFactory message={dbMessage} {...renderers} status={status} />;
};

export const Txtmessage = ({
  txt,
  role,
  metadata,
}: {
  txt: string;
  role: MastraDBMessage['role'] | null;
  metadata?: MessageMetadata;
}) => {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <Txt
          variant="ui-md"
          className="bg-white text-black rounded-2xl px-4 py-2.5 max-w-[80%] [&_ul]:!space-y-1 [&_ol]:!space-y-1 [&_li]:!my-0 [&_p]:!leading-normal [&_p]:!whitespace-normal [&_li]:!leading-normal"
          as="div"
        >
          <MarkdownRenderer>{txt}</MarkdownRenderer>
        </Txt>
      </div>
    );
  }

  if (role === 'assistant' || role === 'system') {
    return (
      <Txt
        variant="ui-md"
        className="text-neutral4 max-w-[80%] [&_ul]:!space-y-1 [&_ol]:!space-y-1 [&_li]:!my-0 [&_p]:!leading-normal [&_p]:!whitespace-normal [&_li]:!leading-normal"
        as="div"
      >
        <MessageText text={txt} metadata={metadata} />
      </Txt>
    );
  }

  return null;
};

export const ErrorMessage = ({ error, onRetry }: { error: ParsedStreamError; onRetry: (() => void) | null }) => {
  return (
    <Card
      className="border-accent6/40 bg-accent6/5 max-w-[80%] p-4 flex flex-col gap-3"
      role="alert"
      data-testid="agent-builder-chat-error"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-accent6" aria-hidden />
        <div className="flex flex-col gap-1 min-w-0">
          <Txt variant="ui-md" className="text-icon6 font-medium" as="div">
            Something went wrong while building the agent.
          </Txt>
          <Txt
            variant="ui-sm"
            className="text-neutral4 break-words"
            as="div"
            data-testid="agent-builder-chat-error-summary"
          >
            {error.summary}
          </Txt>
        </div>
      </div>

      {error.details && error.details !== error.summary ? (
        <Collapsible className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {onRetry !== null && (
              <Button
                variant="default"
                onClick={onRetry}
                className="gap-1.5"
                data-testid="agent-builder-chat-error-retry"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Try again
              </Button>
            )}
            <CollapsibleTrigger
              className="text-neutral4 hover:text-neutral6 text-sm underline-offset-2 hover:underline"
              data-testid="agent-builder-chat-error-details-trigger"
            >
              Details
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <pre
              className="text-xs text-neutral4 whitespace-pre-wrap break-all bg-surface1 rounded-md p-2 max-h-48 overflow-auto"
              data-testid="agent-builder-chat-error-details"
            >
              {error.details}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        onRetry !== null && (
          <div className="flex items-center gap-3">
            <Button
              variant="default"
              onClick={onRetry}
              className="gap-1.5"
              data-testid="agent-builder-chat-error-retry"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Try again
            </Button>
          </div>
        )
      )}
    </Card>
  );
};

export const MessagesSkeleton = ({ testId }: { testId?: string }) => {
  return (
    <div className="flex flex-col gap-6" data-testid={testId}>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-56 rounded-2xl" />
      </div>
      <Skeleton className="h-6 w-[70%] rounded-full" />
      <Skeleton className="h-6 w-[55%] rounded-full" />
      <div className="flex justify-end">
        <Skeleton className="h-10 w-40 rounded-2xl" />
      </div>
      <Skeleton className="h-6 w-[65%] rounded-full" />
    </div>
  );
};

const safeStringify = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const GenericTool = ({ toolName, input, output }: { toolName: string; input?: unknown; output?: unknown }) => {
  const inputJson = safeStringify(input);
  const outputJson = safeStringify(output);
  const hasOutput = outputJson.length > 0;
  const failed = output !== null && typeof output === 'object' && 'success' in output && output.success === false;
  const status = hasOutput ? (failed ? 'Failed' : 'Completed') : 'Executing';

  return (
    <ToolCard testId="agent-builder-chat-generic-tool">
      <Collapsible>
        <CollapsibleTrigger
          className="flex w-full items-center gap-2 text-left group"
          data-testid="agent-builder-chat-generic-tool-trigger"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border1/60 bg-surface1 px-2 py-0.5">
            <Wrench className="size-3.5 shrink-0 text-neutral4" aria-hidden />
            <Txt variant="ui-sm" className="text-neutral5" as="span">
              {status} <span className="font-mono text-neutral6">{toolName}</span>
            </Txt>
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-neutral4 transition-transform group-data-[state=open]:rotate-90"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 flex flex-col gap-2" data-testid="agent-builder-chat-generic-tool-content">
            <div className="rounded-md border border-border1/60 bg-surface1 overflow-hidden">
              <div className="px-2 py-1 border-b border-border1/60">
                <Txt variant="ui-sm" className="text-neutral3" as="div">
                  Input
                </Txt>
              </div>
              <pre className="m-0 max-h-[320px] overflow-auto p-3 text-xs leading-relaxed text-neutral5 whitespace-pre-wrap break-words">
                {inputJson || '{}'}
              </pre>
            </div>
            {hasOutput ? (
              <div className="rounded-md border border-border1/60 bg-surface1 overflow-hidden">
                <div className="px-2 py-1 border-b border-border1/60">
                  <Txt variant="ui-sm" className="text-neutral3" as="div">
                    Output
                  </Txt>
                </div>
                <pre className="m-0 max-h-[320px] overflow-auto p-3 text-xs leading-relaxed text-neutral5 whitespace-pre-wrap break-words">
                  {outputJson}
                </pre>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ToolCard>
  );
};

export const ToolCard = ({
  children,
  testId,
  className,
}: {
  children: ReactNode;
  testId?: string;
  className?: string;
}) => (
  <Card
    data-testid={testId}
    className={cn(
      'max-w-[80%] p-3 bg-surface2/60 border-border1/60 animate-in fade-in slide-in-from-left-2 duration-300',
      className,
    )}
  >
    {children}
  </Card>
);

const SkillToolLine = ({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) => (
  <div className="flex items-start gap-2 min-w-0 max-w-full animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
    <div className="pt-0.5">
      <Icon>{icon}</Icon>
    </div>
    <Txt variant="ui-md" className="text-neutral3 min-w-0 flex-1 truncate" as="div">
      {label} <strong className="font-semibold text-neutral6">{value}</strong>
    </Txt>
  </div>
);

const MessageSetAgentName = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const name = watch('name');

  if (!name) return null;

  return <SkillToolLine icon={<AlignLeft />} label="Setting the agent name:" value={name} />;
};

const MessageSetAgentDescription = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const description = watch('description');

  if (!description) return null;

  return <SkillToolLine icon={<AlignLeft />} label="Setting the agent description:" value={description} />;
};

const MessageSetAgentInstructions = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const instructions = watch('instructions');

  if (!instructions) return null;

  return <SkillToolLine icon={<FileText />} label="Setting the agent instructions:" value={instructions} />;
};

const MessageSetAgentTools = () => {
  const { agentId, toolsData, agentsData, workflowsData } = useAgentPrimitives();
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const selectedTools = watch('tools');
  const selectedAgents = watch('agents');
  const selectedWorkflows = watch('workflows');

  const availableAgentTools = useAvailableAgentTools({
    toolsData,
    agentsData,
    workflowsData,
    selectedTools,
    selectedAgents,
    selectedWorkflows,
    excludeAgentId: agentId,
  });

  const enabled = availableAgentTools.filter(t => t.isChecked);
  const value = enabled.length === 0 ? 'none' : enabled.map(t => t.name).join(', ');

  return <SkillToolLine icon={<Wrench />} label="Enabling tools:" value={value} />;
};

const MessageSetAgentSkills = () => {
  const { availableSkills } = useAgentPrimitives();
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const skillsField = watch('skills');
  const enabled = skillsField ? availableSkills.filter(s => skillsField[s.id] === true) : [];
  const value = enabled.length === 0 ? 'none' : enabled.map(s => s.name).join(', ');

  return <SkillToolLine icon={<Zap />} label="Enabling skills:" value={value} />;
};

const MessageSetAgentModel = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const model = watch('model');

  if (!model) return null;

  return (
    <SkillToolLine
      icon={<ProviderLogo providerId={model.provider} size={16} />}
      label="Setting agent model to"
      value={`${model.provider}/${model.name}`}
    />
  );
};

const MessageSetAgentBrowserEnabled = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const browserEnabled = watch('browserEnabled');

  return (
    <SkillToolLine
      icon={browserEnabled ? <Globe /> : <GlobeLockIcon />}
      label="Browser access"
      value={browserEnabled ? 'enabled' : 'disabled'}
    />
  );
};

const MessageSetAgentWorkspaceId = () => {
  const { watch } = useFormContext<AgentBuilderEditFormValues>();
  const workspaceId = watch('workspaceId');

  if (!workspaceId) return null;

  return <SkillToolLine icon={<Building />} label="Setting workspace to" value={workspaceId} />;
};

interface SkillToolProps {
  name: string;
}

const SkillTool = ({ name }: SkillToolProps) => (
  <SkillToolLine icon={<Zap />} label="Using super-powers:" value={name} />
);
