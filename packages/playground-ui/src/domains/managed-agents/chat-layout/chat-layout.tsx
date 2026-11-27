import { ChatLayoutDesktop } from './chat-layout-desktop';
import { ChatLayoutMobile } from './chat-layout-mobile';
import { CHAT_LAYOUT_SHORTCUTS } from './chat-layout-types';
import type { ChatLayoutProps } from './chat-layout-types';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useKeydown } from '@/lib/keyboard/use-keydown';

function useChatLayoutShortcuts({
  threads,
  threadsOpen,
  onThreadsOpenChange,
  details,
  detailsOpen,
  onDetailsOpenChange,
}: ChatLayoutProps) {
  const bindings: Record<string, () => void> = {};
  if (threads && onThreadsOpenChange) bindings[CHAT_LAYOUT_SHORTCUTS.threads] = () => onThreadsOpenChange(!threadsOpen);
  if (details) bindings[CHAT_LAYOUT_SHORTCUTS.details] = () => onDetailsOpenChange(!detailsOpen);
  useKeydown(bindings, { repeat: false });
}

export function ChatLayout(props: ChatLayoutProps) {
  const mobile = useIsMobile();
  useChatLayoutShortcuts(props);
  if (mobile) return <ChatLayoutMobile {...props} />;
  const { onDetailsOpenChange: _onDetailsOpenChange, onThreadsOpenChange: _onThreadsOpenChange, ...desktop } = props;
  return <ChatLayoutDesktop {...desktop} />;
}
