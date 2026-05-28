import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import {
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  MarkdownRenderer,
  Skeleton,
  Txt,
} from '@mastra/playground-ui';
import {
  AlignLeft,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  Wrench,
  Zap,
  GlobeLockIcon,
  Building,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAgentPrimitives } from '../../contexts/agent-primitives-context';
import { useAvailableAgentTools } from '../../hooks/use-available-agent-tools';
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
  message: MastraDBMessage;
}

export const MessageRow = ({ message }: MessageRowProps) => {
  const parts = message.content?.parts ?? [];
  return (
    <>
      {parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === 'text') {
          return <Txtmessage key={key} txt={part.text} role={message.role} />;
        }

        if (part.type === 'reasoning') {
          if ((part as { state?: string }).state !== 'streaming') return null;
          return <ReasoningMessage key={key} text="Reasoning..." streaming />;
        }

        if (part.type === 'tool-invocation') {
          const inv = part.toolInvocation;
          if (inv.state !== 'result') return null;
          const toolName = inv.toolName;
          const input = (inv as { args?: unknown }).args;
          const output = (inv as { result?: unknown }).result;

          switch (toolName) {
            case SET_AGENT_NAME_TOOL_NAME:
              return <MessageSetAgentName key={key} />;
            case SET_AGENT_DESCRIPTION_TOOL_NAME:
              return <MessageSetAgentDescription key={key} />;
            case SET_AGENT_INSTRUCTIONS_TOOL_NAME:
              return <MessageSetAgentInstructions key={key} />;
            case SET_AGENT_TOOLS_TOOL_NAME:
              return <MessageSetAgentTools key={key} />;
            case SET_AGENT_SKILLS_TOOL_NAME:
              return <MessageSetAgentSkills key={key} />;
            case SET_AGENT_MODEL_TOOL_NAME:
              return <MessageSetAgentModel key={key} />;
            case SET_AGENT_BROWSER_ENABLED_TOOL_NAME:
              return <MessageSetAgentBrowserEnabled key={key} />;
            case SET_AGENT_WORKSPACE_ID_TOOL_NAME:
              return <MessageSetAgentWorkspaceId key={key} />;
            case 'skill':
              return <SkillTool key={key} name={(input as { name?: string } | undefined)?.name ?? 'unknown'} />;
            default:
              return <GenericTool key={key} toolName={toolName} input={input} output={output} />;
          }
        }

        return null;
      })}
    </>
  );
};

export const Txtmessage = ({ txt, role }: { txt: string; role: MastraDBMessage['role'] }) => {
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

export const ToolCard = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <Card
    data-testid={testId}
    className="max-w-[80%] p-3 bg-surface2/60 border-border1/60 animate-in fade-in slide-in-from-left-2 duration-300"
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
