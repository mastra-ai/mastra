import { ChatLayoutDesktop } from './chat-layout-desktop';
import { ChatLayoutMobile } from './chat-layout-mobile';
import type { ChatLayoutProps } from './chat-layout-types';
import { useChatLayoutShortcuts } from './use-chat-layout-shortcuts';
import { useIsMobile } from '@/hooks/use-is-mobile';

export function ChatLayout(props: ChatLayoutProps) {
  const mobile = useIsMobile();
  const resolved = { ...props, threadsOpen: props.threadsOpen ?? !mobile };
  useChatLayoutShortcuts(resolved);
  if (mobile) return <ChatLayoutMobile {...resolved} />;
  const { onDetailsOpenChange: _onDetailsOpenChange, onThreadsOpenChange: _onThreadsOpenChange, ...desktop } = resolved;
  return <ChatLayoutDesktop {...desktop} />;
}
