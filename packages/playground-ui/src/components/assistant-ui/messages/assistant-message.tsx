import { ActionBarPrimitive, MessagePrimitive, ToolCallMessagePartComponent, useMessage } from '@assistant-ui/react';
import { AudioLinesIcon, CheckIcon, CopyIcon, StopCircleIcon } from 'lucide-react';

import { MarkdownText } from './markdown-text';
import { TooltipIconButton } from '../tooltip-icon-button';
import { ToolFallback } from '@/components/assistant-ui/tools/tool-fallback';
import { Reasoning } from './reasoning';

export interface AssistantMessageProps {
  ToolFallback?: ToolCallMessagePartComponent;
}

export const AssistantMessage = ({ ToolFallback: ToolFallbackCustom }: AssistantMessageProps) => {
  const data = useMessage();
  const messageId = data.id;

  const isToolCallAndOrReasoning = data.content.every(({ type }) => type === 'tool-call' || type === 'reasoning');

  return (
    <MessagePrimitive.Root className="max-w-full" data-message-id={messageId}>
      <div className="text-icon6 text-ui-lg leading-ui-lg">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallbackCustom || ToolFallback },
            Reasoning: Reasoning,
          }}
        />
      </div>
      {!isToolCallAndOrReasoning && (
        <div className="h-6 pt-1">
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
