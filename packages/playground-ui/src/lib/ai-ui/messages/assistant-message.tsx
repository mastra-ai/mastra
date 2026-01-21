import { ActionBarPrimitive, MessagePrimitive, useMessage } from '@assistant-ui/react';
import { AudioLinesIcon, CheckIcon, CopyIcon, StopCircleIcon } from 'lucide-react';

import { ErrorAwareText } from './error-aware-text';
import { TooltipIconButton } from '../tooltip-icon-button';
import { ToolFallback } from '../tools/tool-fallback';
import { Reasoning } from './reasoning';
import { cn } from '@/lib/utils';
import { ProviderLogo } from '@/domains/agents/components/agent-metadata/provider-logo';

/**
 * Content item type for assistant message content parts.
 */
interface ContentItem {
  type: string;
  data?: unknown;
  metadata?: {
    mode?: string;
    completionResult?: unknown;
  };
}

export interface AssistantMessageProps {
  hasModelList?: boolean;
}

export const AssistantMessage = ({ 
  hasModelList, 
}: AssistantMessageProps) => {
  const data = useMessage();
  const messageId = data.id;

  const isNotAssistantTextResponse = (data.content as readonly ContentItem[]).every(
    ({ type, metadata }) =>
      type === 'tool-call' ||
      type === 'reasoning' ||
      (type === 'text' && metadata?.mode === 'network' && metadata?.completionResult),
  );

  const modelMetadata = data.metadata?.custom?.modelMetadata as { modelId: string; modelProvider: string } | undefined;

  const showModelUsed = hasModelList && modelMetadata;

  return (
    <MessagePrimitive.Root className="max-w-full" data-message-id={messageId}>
      <div className="text-neutral6 text-ui-lg leading-ui-lg">
        <MessagePrimitive.Parts
          components={{
            Text: ErrorAwareText,
            tools: { Fallback: ToolFallback },
            Reasoning: Reasoning,
          }}
        />
      </div>
      {!isNotAssistantTextResponse && (
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
        <TooltipIconButton tooltip="Copy" className="bg-transparent text-neutral3 hover:text-neutral6">
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
