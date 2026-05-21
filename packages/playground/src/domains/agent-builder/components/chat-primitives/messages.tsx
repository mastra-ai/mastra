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
import type { MastraUIMessage } from '@mastra/react';
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
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { CONNECT_CHANNEL_TOOL_NAME } from '../../hooks/use-connect-channel-tool';
import { ConnectChannelMessage } from '../agent-edit/connect-channel-message';
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
  agentId?: string;
}

export const MessageRow = ({ message, agentId }: MessageRowProps) => {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case 'text':
            return <Txtmessage key={key} txt={part.text} role={message.role} />;

          case 'reasoning': {
            if (part.state !== 'streaming') return null;

            return <ReasoningMessage key={key} text="Reasoning..." streaming />;
          }

          case 'dynamic-tool': {
            switch (part.toolName) {
              case CONNECT_CHANNEL_TOOL_NAME: {
                const platform = (part.input as { platform?: string } | undefined)?.platform ?? 'slack';
                return (
                  <ToolCard key={key}>
                    <ConnectChannelMessage platformId={platform} agentId={agentId} />
                  </ToolCard>
                );
              }
              case SET_AGENT_NAME_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                return <MessageSetAgentName key={key} />;
              }

              case SET_AGENT_DESCRIPTION_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                return <MessageSetAgentDescription key={key} />;
              }
              case SET_AGENT_INSTRUCTIONS_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                return <MessageSetAgentInstructions key={key} />;
              }

              case SET_AGENT_TOOLS_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                const input = (part.input as { tools?: { id: string; name: string }[] } | undefined) ?? {};
                return <MessageSetAgentTools key={key} tools={input.tools ?? []} />;
              }
              case SET_AGENT_SKILLS_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                const input = (part.input as { skills?: { id: string; name: string }[] } | undefined) ?? {};
                return <MessageSetAgentSkills key={key} skills={input.skills ?? []} />;
              }
              case SET_AGENT_MODEL_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                const input = (part.input as { model?: { provider: string; name: string } } | undefined) ?? {};
                return <MessageSetAgentModel key={key} model={input.model ?? { provider: '', name: '' }} />;
              }
              case SET_AGENT_BROWSER_ENABLED_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                const input = (part.input as { browserEnabled?: boolean } | undefined) ?? {};
                return <MessageSetAgentBrowserEnabled key={key} browserEnabled={input.browserEnabled ?? false} />;
              }
              case SET_AGENT_WORKSPACE_ID_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                const input = (part.input as { workspaceId?: string } | undefined) ?? {};
                return <MessageSetAgentWorkspaceId key={key} workspaceId={input.workspaceId ?? ''} />;
              }
              default: {
                if (part?.state !== 'output-available') return null;

                if (part.toolName === 'skill') {
                  return <SkillTool name={(part.input as { name?: string } | undefined)?.name ?? 'unknown'} />;
                }

                const extra = part as { input?: unknown; output?: unknown };
                return <GenericTool key={key} toolName={part.toolName} input={extra.input} output={extra.output} />;
              }
            }
          }

          case `tool-${CONNECT_CHANNEL_TOOL_NAME}`: {
            const platform = (part.input as { platform?: string } | undefined)?.platform ?? 'slack';
            return (
              <ToolCard key={key}>
                <ConnectChannelMessage platformId={platform} agentId={agentId} />
              </ToolCard>
            );
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

            const input = (part.input as { tools?: { id: string; name: string }[] } | undefined) ?? {};
            return <MessageSetAgentTools key={key} tools={input.tools ?? []} />;
          }
          case `tool-${SET_AGENT_SKILLS_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            const input = (part.input as { skills?: { id: string; name: string }[] } | undefined) ?? {};
            return <MessageSetAgentSkills key={key} skills={input.skills ?? []} />;
          }
          case `tool-${SET_AGENT_MODEL_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            const input = (part.input as { model?: { provider: string; name: string } } | undefined) ?? {};
            return <MessageSetAgentModel key={key} model={input.model ?? { provider: '', name: '' }} />;
          }
          case `tool-${SET_AGENT_BROWSER_ENABLED_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            const input = (part.input as { browserEnabled?: boolean } | undefined) ?? {};
            return <MessageSetAgentBrowserEnabled key={key} browserEnabled={input.browserEnabled ?? false} />;
          }
          case `tool-${SET_AGENT_WORKSPACE_ID_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            const input = (part.input as { workspaceId?: string } | undefined) ?? {};
            return <MessageSetAgentWorkspaceId key={key} workspaceId={input.workspaceId ?? ''} />;
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

const words = [
  'loading',
  'cooking',
  'processing',
  'preparing',
  'building',
  'rendering',
  'fetching',
  'compiling',
  'generating',
  'brewing',
  'mixing',
  'heating',
  'baking',
  'roasting',
  'simmering',
  'boiling',
  'frying',
  'grilling',
  'steaming',
  'toasting',
  'melting',
  'blending',
  'stirring',
  'whisking',
  'kneading',
  'assembling',
  'crafting',
  'forging',
  'shaping',
  'forming',
  'spinning',
  'warming',
  'igniting',
  'starting',
  'booting',
  'charging',
  'spooling',
  'buffering',
  'calculating',
  'computing',
  'decoding',
  'encoding',
  'hydrating',
  'marinating',
  'infusing',
  'curing',
  'plating',
  'serving',
  'finishing',
  'settling',
];

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

export const ToolExecutionMessage = () => {
  const [randomWord] = useState(() => words[Math.floor(Math.random() * words.length)]);
  return (
    <Txt variant="ui-md" className="whitespace-pre-wrap leading-relaxed text-neutral4 max-w-[80%]">
      {randomWord.charAt(0).toUpperCase() + randomWord.slice(1)}...
    </Txt>
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

export const GenericTool = ({ toolName, input, output }: { toolName: string; input?: unknown; output?: unknown }) => {
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
    <Icon>{icon}</Icon>
    <Txt variant="ui-md" className="text-neutral3 min-w-0 flex-1 truncate" as="div">
      {label}{' '}
      <strong className="font-semibold text-neutral6">{value}</strong>
    </Txt>
  </div>
);

export const MessageSetAgentName = () => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="name"
      render={({ field }) => (
        <SkillToolLine icon={<AlignLeft />} label="Setting the agent name:" value={field.value ?? ''} />
      )}
    />
  );
};

export const MessageSetAgentDescription = () => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="description"
      render={({ field }) => (
        <SkillToolLine icon={<AlignLeft />} label="Setting the agent description:" value={field.value ?? ''} />
      )}
    />
  );
};

export const MessageSetAgentInstructions = () => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="instructions"
      render={({ field }) => {
        const text = field.value ?? '';
        const snippet = text.length > 60 ? `${text.slice(0, 60)}…` : text;
        return (
          <SkillToolLine icon={<FileText />} label="Setting the agent instructions:" value={snippet} />
        );
      }}
    />
  );
};

export const MessageSetAgentTools = ({ tools }: { tools: { id: string; name: string }[] }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="tools"
      render={({ field }) => {
        const enabled = field.value
          ? tools.filter(t => field.value?.[t.id])
          : tools;
        const value = enabled.length === 0 ? 'none' : enabled.map(t => t.name).join(', ');
        return <SkillToolLine icon={<Wrench />} label="Enabling tools:" value={value} />;
      }}
    />
  );
};

export const MessageSetAgentSkills = ({ skills }: { skills: { id: string; name: string }[] }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="skills"
      render={({ field }) => {
        const enabled = field.value
          ? skills.filter(s => field.value?.[s.id])
          : skills;
        const value = enabled.length === 0 ? 'none' : enabled.map(s => s.name).join(', ');
        return <SkillToolLine icon={<Zap />} label="Enabling skills:" value={value} />;
      }}
    />
  );
};

export const MessageSetAgentModel = ({ model }: { model: { provider: string; name: string } }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="model"
      render={({ field }) => {
        const value = field.value ?? model;
        return (
          <SkillToolLine
            icon={<ProviderLogo providerId={value.provider} size={16} />}
            label="Setting agent model to"
            value={`${value.provider}/${value.name}`}
          />
        );
      }}
    />
  );
};

export const MessageSetAgentBrowserEnabled = ({ browserEnabled }: { browserEnabled: boolean }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="browserEnabled"
      render={({ field }) => {
        const enabled = field.value ?? browserEnabled;
        return (
          <SkillToolLine
            icon={enabled ? <Globe /> : <GlobeLockIcon />}
            label="Browser access"
            value={enabled ? 'enabled' : 'disabled'}
          />
        );
      }}
    />
  );
};

export const MessageSetAgentWorkspaceId = ({ workspaceId }: { workspaceId: string }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();

  return (
    <Controller
      control={control}
      name="workspaceId"
      render={({ field }) => {
        const value = field.value ?? workspaceId;
        return <SkillToolLine icon={<Building />} label="Setting workspace to" value={value} />;
      }}
    />
  );
};

interface SkillToolProps {
  name: string;
}

const SkillTool = ({ name }: SkillToolProps) => (
  <SkillToolLine icon={<Zap />} label="Using super-powers:" value={name} />
);
