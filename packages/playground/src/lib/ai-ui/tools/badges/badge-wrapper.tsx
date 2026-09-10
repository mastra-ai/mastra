import { ToolBadgeDisclosure } from '@mastra/playground-ui/domains/chat';
import type { ToolBadgeDisclosureProps } from '@mastra/playground-ui/domains/chat';
import { useChatRunning } from '@/lib/ai-ui/chat/chat-context';

export type BadgeWrapperProps = Omit<ToolBadgeDisclosureProps, 'isRunning' | 'onToolOpen'>;

export const BadgeWrapper = (props: BadgeWrapperProps) => {
  const { isRunning } = useChatRunning();
  return <ToolBadgeDisclosure {...props} isRunning={isRunning} />;
};
