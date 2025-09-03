import {
  ActionBarPrimitive,
  MessagePrimitive,
  TextMessagePart,
  ToolCallMessagePartComponent,
  useMessage,
} from '@assistant-ui/react';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { FC } from 'react';

import { ToolFallback } from '@/components/assistant-ui/tools/tool-fallback';
import { MarkdownText } from '@/components/assistant-ui/messages/markdown-text';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { StepDropdown } from './step-dropdown';

export const NextAssistantMessage: FC<{ ToolFallback?: ToolCallMessagePartComponent }> = ({
  ToolFallback: ToolFallbackCustom,
}) => {
  const data = useMessage();
  const isSolelyToolCall = data.content.length === 1 && data.content[0].type === 'tool-call';

  const content = data.content[0];

  if (!content) {
    return null;
  }

  const textContent = (content as TextMessagePart).text;

  if (textContent === 'start') {
    return <StepDropdown />;
  }

  return (
    <MessagePrimitive.Root className="max-w-full">
      <div className="text-icon6 text-ui-lg leading-ui-lg">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallbackCustom || ToolFallback },
          }}
        />
      </div>
      <div className="h-6 pt-1">{!isSolelyToolCall && <AssistantActionBar />}</div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="always"
      autohideFloat="single-branch"
      className="flex gap-1 items-center transition-all"
    >
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
    </ActionBarPrimitive.Root>
  );
};
