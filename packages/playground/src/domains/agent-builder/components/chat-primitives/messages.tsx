import {
  Card,
  CodeEditor,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  MarkdownRenderer,
  Skeleton,
  TextFieldBlock,
  Txt,
} from '@mastra/playground-ui';
import type { MastraUIMessage } from '@mastra/react';
import { AlignLeft, Check, ChevronRight, FileText, Globe, Loader2, Sparkles, Type, Wrench } from 'lucide-react';
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
import { LLMModels, LLMProviders, cleanProviderId } from '@/domains/llm';

interface MessageRowProps {
  message: MastraUIMessage;
  agentId?: string;
  isStreaming?: boolean;
  mode?: 'edit' | 'view';
}

export const MessageRow = ({ message, agentId, isStreaming = false, mode }: MessageRowProps) => {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        switch (part.type) {
          case 'text':
            return <Txtmessage key={key} txt={part.text} role={message.role} />;

          case 'reasoning': {
            if (!part.state) return null;

            if (mode === 'view') {
              return part.state === 'streaming' ? (
                <ReasoningMessage key={key} text="Anayzing the user's requirements..." streaming />
              ) : (
                <ReasoningMessage key={key} text="Requirements analyzed." />
              );
            }

            return part.state === 'streaming' ? (
              <ReasoningMessage key={key} text="Anayzing the agent requirements..." streaming />
            ) : (
              <ReasoningMessage key={key} text="Requirements analyzed, preparing the agent." />
            );
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
                return <MessageSetAgentName key={key} disabled={isStreaming} />;
              }

              case SET_AGENT_DESCRIPTION_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                return <MessageSetAgentDescription key={key} disabled={isStreaming} />;
              }
              case SET_AGENT_INSTRUCTIONS_TOOL_NAME: {
                if (part?.state !== 'output-available') return null;
                return <MessageSetAgentInstructions key={key} disabled={isStreaming} />;
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
                return (
                  <MessageSetAgentModel
                    key={key}
                    model={input.model ?? { provider: '', name: '' }}
                    disabled={isStreaming}
                  />
                );
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

            return <MessageSetAgentName key={key} disabled={isStreaming} />;
          }

          case `tool-${SET_AGENT_DESCRIPTION_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentDescription key={key} disabled={isStreaming} />;
          }

          case `tool-${SET_AGENT_INSTRUCTIONS_TOOL_NAME}`: {
            if (part?.state !== 'output-available') return null;

            return <MessageSetAgentInstructions key={key} disabled={isStreaming} />;
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
            return (
              <MessageSetAgentModel
                key={key}
                model={input.model ?? { provider: '', name: '' }}
                disabled={isStreaming}
              />
            );
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

const ToolMessageLine = ({ children }: { children: ReactNode }) => (
  <Txt variant="ui-md" className="whitespace-pre-wrap leading-relaxed text-neutral4" as="div">
    {children}
  </Txt>
);

const ToolCardField = ({
  icon,
  label,
  helpText,
  children,
}: {
  icon: ReactNode;
  label: string;
  helpText: string;
  children: ReactNode;
}) => (
  <ToolCard>
    <div className="flex items-start gap-3">
      <div className="mt-1 text-neutral4">{icon}</div>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <Txt variant="ui-md" className="text-neutral6" as="div">
            {label}
          </Txt>
          <Txt variant="ui-sm" className="text-neutral3" as="div">
            {helpText}
          </Txt>
        </div>
        {children}
      </div>
    </div>
  </ToolCard>
);

export const MessageSetAgentName = ({ disabled = false }: { disabled?: boolean }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  return (
    <ToolCardField
      icon={<Type className="size-5 shrink-0" aria-hidden />}
      label="Agent name"
      helpText="The display name shown to users."
    >
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextFieldBlock
            name={field.name}
            label="Agent name"
            labelIsHidden
            size="md"
            placeholder="Untitled agent"
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            testId="agent-builder-chat-set-agent-name-input"
          />
        )}
      />
    </ToolCardField>
  );
};

export const MessageSetAgentDescription = ({ disabled = false }: { disabled?: boolean }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  return (
    <ToolCardField
      icon={<AlignLeft className="size-5 shrink-0" aria-hidden />}
      label="Agent description"
      helpText="A short summary shown when browsing agents."
    >
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextFieldBlock
            name={field.name}
            label="Agent description"
            labelIsHidden
            size="md"
            placeholder="What is this agent for?"
            value={field.value ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            testId="agent-builder-chat-set-agent-description-input"
          />
        )}
      />
    </ToolCardField>
  );
};

export const MessageSetAgentInstructions = ({ disabled = false }: { disabled?: boolean }) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  return (
    <ToolCard>
      <Collapsible>
        <CollapsibleTrigger
          className="flex w-full items-start gap-3 text-left"
          data-testid="agent-builder-chat-set-agent-instructions-trigger"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <FileText className="size-5 shrink-0 text-neutral4 mt-0.5" aria-hidden />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <Txt variant="ui-md" className="text-neutral6" as="div">
                Agent instructions
              </Txt>
              <Txt variant="ui-sm" className="text-neutral3" as="div">
                The system prompt that guides the agent. Click to view or edit.
              </Txt>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-neutral4 mt-1" aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className="mt-3 rounded-md border border-border1/60 bg-surface1 overflow-hidden"
            data-testid="agent-builder-chat-set-agent-instructions-editor"
          >
            <Controller
              control={control}
              name="instructions"
              render={({ field }) => (
                <CodeEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  language="markdown"
                  editable={!disabled}
                  placeholder="You are a helpful assistant that…"
                  showCopyButton={false}
                  className="min-h-[160px] max-h-[320px] overflow-auto border-0 bg-transparent p-3 rounded-none"
                />
              )}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ToolCard>
  );
};

export const MessageSetAgentTools = ({ tools }: { tools: { id: string; name: string }[] }) => (
  <ToolCard>
    <div className="flex items-start gap-3">
      <Wrench className="size-5 shrink-0 text-neutral4" aria-hidden />
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <Txt variant="ui-md" className="text-neutral6" as="div">
            {tools.length === 0 ? 'No tools enabled' : `${tools.length} tool${tools.length === 1 ? '' : 's'} enabled`}
          </Txt>
          <Txt variant="ui-sm" className="text-neutral3" as="div">
            Your agent will use these tools to complete tasks.
          </Txt>
        </div>
        {tools.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {tools.map(t => (
              <li key={t.id} className="rounded-md border border-border1 bg-surface3 px-2 py-1">
                <Txt variant="ui-sm" className="text-neutral6 truncate" as="span">
                  {t.name}
                </Txt>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  </ToolCard>
);

export const MessageSetAgentSkills = ({ skills }: { skills: { id: string; name: string }[] }) => (
  <ToolCard>
    <ToolMessageLine>Enabling skills: {skills.map(s => s.name).join(', ')}</ToolMessageLine>
  </ToolCard>
);

export const MessageSetAgentModel = ({
  model,
  disabled = false,
}: {
  model: { provider: string; name: string };
  disabled?: boolean;
}) => {
  const { control, setValue } = useFormContext<AgentBuilderEditFormValues>();
  const fallbackLabel =
    model.provider && model.name ? `${model.provider}/${model.name}` : 'Pick the AI model that powers your agent.';
  return (
    <ToolCardField
      icon={<Sparkles className="size-5 shrink-0" aria-hidden />}
      label="Agent model"
      helpText={fallbackLabel}
    >
      <Controller
        control={control}
        name="model"
        render={({ field }) => {
          const provider = field.value?.provider ?? '';
          const modelId = field.value?.name ?? '';
          return (
            <div
              className="flex flex-col gap-2 min-w-0 sm:flex-row sm:items-center"
              data-testid="agent-builder-chat-set-agent-model"
            >
              <div className="flex-1 basis-0 min-w-0">
                <LLMProviders
                  value={provider}
                  onValueChange={next => {
                    const cleaned = cleanProviderId(next);
                    setValue('model', { provider: cleaned, name: '' }, { shouldDirty: true });
                  }}
                  disabled={disabled}
                  className="w-full !min-w-0"
                />
              </div>
              <div className="flex-1 basis-0 min-w-0">
                <LLMModels
                  llmId={provider}
                  value={modelId}
                  onValueChange={next => {
                    setValue('model', { provider: cleanProviderId(provider), name: next }, { shouldDirty: true });
                  }}
                  disabled={disabled}
                  className="w-full !min-w-0"
                />
              </div>
            </div>
          );
        }}
      />
    </ToolCardField>
  );
};

export const MessageSetAgentBrowserEnabled = ({ browserEnabled }: { browserEnabled: boolean }) => (
  <ToolCard>
    <div className="flex items-start gap-3">
      <Globe className="size-5 shrink-0 text-neutral4" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <Txt variant="ui-md" className="text-neutral6" as="div">
          {browserEnabled ? 'Browser access enabled' : 'Browser access disabled'}
        </Txt>
        <Txt variant="ui-sm" className="text-neutral3" as="div">
          {browserEnabled
            ? 'Your agent will now be able to interact with web pages'
            : 'Your agent will no longer interact with web pages'}
        </Txt>
      </div>
    </div>
  </ToolCard>
);

export const MessageSetAgentWorkspaceId = ({ workspaceId }: { workspaceId: string }) => (
  <ToolCard>
    <ToolMessageLine>Setting workspace to: {workspaceId}</ToolMessageLine>
  </ToolCard>
);
