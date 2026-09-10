import { ToolBadgeDisclosure } from '@mastra/playground-ui/domains/chat';
import type { ToolBadgeDisclosureProps } from '@mastra/playground-ui/domains/chat';
import { useTraceHighlight } from '@/domains/traces/components/trace-highlight-context';
import { useChatRunning } from '@/lib/ai-ui/chat/chat-context';

export type BadgeWrapperProps = Omit<ToolBadgeDisclosureProps, 'isRunning' | 'onToolOpen'>;

export const BadgeWrapper = (props: BadgeWrapperProps) => {
  const { isRunning } = useChatRunning();
  const { onToolOpen } = useTraceHighlight();
  return <ToolBadgeDisclosure {...props} isRunning={isRunning} onToolOpen={onToolOpen} />;
};
