import { ActionBarPrimitive, MessagePrimitive, ToolCallMessagePartComponent, useMessage } from '@assistant-ui/react';
import { AudioLinesIcon, CheckIcon, CopyIcon, StopCircleIcon, Triangle, TriangleAlert } from 'lucide-react';

import { ErrorAwareText } from './error-aware-text';
import { TooltipIconButton } from '../tooltip-icon-button';
import { ToolFallback } from '@/components/assistant-ui/tools/tool-fallback';
import { Reasoning } from './reasoning';
import { cn } from '@/lib/utils';
import { ProviderLogo } from '@/domains/agents/components/agent-metadata/provider-logo';
import clsx from 'clsx';
import { Icon } from '@/ds/icons';

export interface AssistantMessageProps {
  ToolFallback?: ToolCallMessagePartComponent;
  hasModelList?: boolean;
}

const statusClasses = {
  warning: 'bg-yellow-900/20 border-sm border-yellow-200 text-yellow-200 rounded-lg px-4 py-2 flex gap-4 items-center',
  default: '',
};

export const AssistantMessage = ({ ToolFallback: ToolFallbackCustom, hasModelList }: AssistantMessageProps) => {
  const data = useMessage();
  const messageId = data.id;

  const isToolCallAndOrReasoning = data.content.every(({ type }) => type === 'tool-call' || type === 'reasoning');

  const modelMetadata = data.metadata?.custom?.modelMetadata as { modelId: string; modelProvider: string } | undefined;
  const messageStatus = data.metadata?.custom?.status as 'warning' | undefined;

  const statusClass = statusClasses[messageStatus || 'default'];

  const showModelUsed = hasModelList && modelMetadata;

  return (
    <MessagePrimitive.Root className="max-w-full" data-message-id={messageId}>
      <div className={clsx('text-icon6 text-ui-lg leading-ui-lg', statusClass)}>
        {messageStatus === 'warning' && (
          <Icon size="lg">
            <TriangleAlert />
          </Icon>
        )}

        <MessagePrimitive.Parts
          components={{
            Text: ErrorAwareText,
            tools: { Fallback: ToolFallbackCustom || ToolFallback },
            Reasoning: Reasoning,
          }}
        />
      </div>
      {!isToolCallAndOrReasoning && (
        <div className={cn('h-6 pt-4 flex gap-2 items-center', { 'pb-1': showModelUsed })}>
          {showModelUsed && (
            <div className="flex items-center gap-1.5">
              <ProviderLogo providerId={modelMetadata.modelProvider} size={14} />
              <span className="text-ui-xs leading-ui-xs">
                {modelMetadata.modelProvider}/{modelMetadata.modelId}
              </span>
            </div>
          )}
          <AssistantActionBar />
        </div>
      )}
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="always"
      autohideFloat="single-branch"
      className="flex gap-1 items-center transition-all relative"
    >
      <MessagePrimitive.If speaking={false}>
        <ActionBarPrimitive.Speak asChild>
          <TooltipIconButton tooltip="Read aloud">
            <AudioLinesIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Speak>
      </MessagePrimitive.If>
      <MessagePrimitive.If speaking>
        <ActionBarPrimitive.StopSpeaking asChild>
          <TooltipIconButton tooltip="Stop">
            <StopCircleIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.StopSpeaking>
      </MessagePrimitive.If>
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" className="bg-transparent text-icon3 hover:text-icon6">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      {/* <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload> */}
    </ActionBarPrimitive.Root>
  );
};
