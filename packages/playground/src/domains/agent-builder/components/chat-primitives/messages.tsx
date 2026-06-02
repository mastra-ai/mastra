import {
  Button,
  Card,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  MarkdownRenderer,
  Skeleton,
  Txt,
} from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
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
import { useAgentPrimitives } from '../../contexts/agent-primitives-context';
import { useStreamApproval, useStreamRetry } from '../../contexts/stream-chat-context';
import { useAvailableAgentTools } from '../../hooks/use-available-agent-tools';
import { parseStreamErrorText } from './parse-stream-error';
import type { ParsedStreamError } from './parse-stream-error';
import { Shimmer } from './shimmer';
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

interface MessageRowProps {
  message: MastraUIMessage;
}

type RequireApprovalMetadata = NonNullable<
  Extract<MastraUIMessage['metadata'], { requireApprovalMetadata?: unknown }>['requireApprovalMetadata']
>;

type ApprovalEntry = RequireApprovalMetadata[string];

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

const getRequireApprovalMetadata = (message: MastraUIMessage): RequireApprovalMetadata | undefined => {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;
  const mode = (metadata as { mode?: unknown }).mode;
  if (mode !== 'stream' && mode !== 'network' && mode !== 'generate') return undefined;
  return (metadata as { requireApprovalMetadata?: RequireApprovalMetadata }).requireApprovalMetadata;
};

const findApprovalEntry = (
  approvals: RequireApprovalMetadata | undefined,
  toolName: string | undefined,
  toolCallId: string | undefined,
): ApprovalEntry | undefined => {
  if (!approvals) return undefined;
  return (toolName ? approvals[toolName] : undefined) ?? (toolCallId ? approvals[toolCallId] : undefined);
};

const getMessageStatus = (message: MastraUIMessage): string | undefined => {
  const metadata = message.metadata as { status?: unknown } | undefined;
  if (!metadata) return undefined;
  return typeof metadata.status === 'string' ? metadata.status : undefined;
};

const getMessageErrorText = (message: MastraUIMessage): string => {
  const textPart = message.parts.find(part => part.type === 'text') as { text?: string } | undefined;
  return textPart?.text ?? '';
};

export const MessageRow = ({ message }: MessageRowProps) => {
  const approvals = getRequireApprovalMetadata(message);
  const retry = useStreamRetry();

  if (getMessageStatus(message) === 'error') {
    const parsed = parseStreamErrorText(getMessageErrorText(message));
    return <ErrorMessage error={parsed} onRetry={retry} />;
  }

  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;

        if (
          approvals &&
          (part.type === 'dynamic-tool' || (typeof part.type === 'string' && part.type.startsWith('tool-')))
        ) {
          const toolPart = part as { toolName?: string; type: string; toolCallId?: string; state?: string };
          const toolName =
            toolPart.toolName ?? (toolPart.type.startsWith('tool-') ? toolPart.type.slice('tool-'.length) : undefined);
          const entry = findApprovalEntry(approvals, toolName, toolPart.toolCallId);
          if (entry && toolPart.state !== 'output-available') {
            return <ToolApprovalPrompt key={key} toolCallId={entry.toolCallId} toolName={entry.toolName} />;
          }
        }

        switch (part.type) {
          case 'text':
            return <Txtmessage key={key} txt={part.text} role={message.role} />;

          case 'reasoning': {
            if (part.state !== 'streaming') return null;

            return <ReasoningMessage key={key} text="Reasoning..." streaming />;
          }

          case 'dynamic-tool': {
            if (part?.state !== 'output-available') return null;
            switch (part.toolName) {
              case SET_AGENT_NAME_TOOL_NAME: {
                return <MessageSetAgentName key={key} />;
              }

              case SET_AGENT_DESCRIPTION_TOOL_NAME: {
                return <MessageSetAgentDescription key={key} />;
              }

              case SET_AGENT_INSTRUCTIONS_TOOL_NAME: {
                return <MessageSetAgentInstructions key={key} />;
              }

              case SET_AGENT_TOOLS_TOOL_NAME: {
                return <MessageSetAgentTools key={key} />;
              }

              case SET_AGENT_SKILLS_TOOL_NAME: {
                return <MessageSetAgentSkills key={key} />;
              }

              case SET_AGENT_MODEL_TOOL_NAME: {
                return <MessageSetAgentModel key={key} />;
              }

              case SET_AGENT_BROWSER_ENABLED_TOOL_NAME: {
                return <MessageSetAgentBrowserEnabled key={key} />;
              }

              case SET_AGENT_WORKSPACE_ID_TOOL_NAME: {
                return <MessageSetAgentWorkspaceId key={key} />;
              }

              default: {
                if (part.toolName === 'skill') {
                  return <SkillTool name={(part.input as { name?: string } | undefined)?.name ?? 'unknown'} />;
                }

                const extra = part as { input?: unknown; output?: unknown };
                return <GenericTool key={key} toolName={part.toolName} input={extra.input} output={extra.output} />;
              }
            }
          }

          case `tool-${SET_AGENT_NAME_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentName key={key} />;
          }

          case `tool-${SET_AGENT_DESCRIPTION_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentDescription key={key} />;
          }

          case `tool-${SET_AGENT_INSTRUCTIONS_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentInstructions key={key} />;
          }
          case `tool-${SET_AGENT_TOOLS_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentTools key={key} />;
          }
          case `tool-${SET_AGENT_SKILLS_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentSkills key={key} />;
          }
          case `tool-${SET_AGENT_MODEL_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentModel key={key} />;
          }
          case `tool-${SET_AGENT_BROWSER_ENABLED_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentBrowserEnabled key={key} />;
          }
          case `tool-${SET_AGENT_WORKSPACE_ID_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentWorkspaceId key={key} />;
          }

          default: {
            if (part.type === 'tool-skill' && part.state === 'output-available') {
              const input = (part.input as { name?: string } | undefined) ?? {};
              return <SkillTool name={input.name ?? 'unknown'} />;
            }

            if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
              const toolName = part.type.slice('tool-'.length);
              const extra = part as { input?: unknown; output?: unknown };
              return <GenericTool key={key} toolName={toolName} input={extra.input} output={extra.output} />;
            }

            return null;
          }
        }
      })}
    </>
  );
};

export const Txtmessage = ({ txt, role }: { txt: string; role: MastraUIMessage['role'] }) => {
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
        <MarkdownRenderer>{txt}</MarkdownRenderer>
      </Txt>
    );
  }

  return null;
};

export const ErrorMessage = ({ error, onRetry }: { error: ParsedStreamError; onRetry: (() => void) | null }) => {
  return (
    <Card
      className="border-accent6/40 bg-accent6/5 max-w-[80%] p-4 flex flex-col gap-3"
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

export const PendingIndicator = () => {
  return (
    <Txt
      variant="ui-md"
      className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%] flex items-center gap-2"
      as="div"
      data-testid="agent-builder-chat-pending"
    >
      <Loader2 className="animate-spin size-4 text-neutral3" />
      <Shimmer>Thinking…</Shimmer>
    </Txt>
  );
};

export const ReasoningMessage = ({ text, streaming = false }: { text: string; streaming?: boolean }) => {
  return (
    <Txt
      variant="ui-md"
      className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%] flex items-center gap-2"
      as="div"
    >
      {streaming ? (
        <>
          <Loader2 className="animate-spin size-4 text-neutral3" />

          <Shimmer>{text}</Shimmer>
        </>
      ) : (
        <>
          <Check className="text-neutral3 size-4" />

          {text}
        </>
      )}
    </Txt>
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
              Executing <span className="font-mono text-neutral6">{toolName}</span>
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
  <div className="flex items-start gap-2 min-w-0 max-w-full">
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
  const skillsField = watch('skills') as Record<string, boolean> | undefined;
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
