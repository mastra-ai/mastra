import { CHAT_LAYOUT_SHORTCUTS } from './chat-layout-types';
import type { ChatLayoutViewProps } from './chat-layout-types';
import { useKeydown } from '@/lib/keyboard/use-keydown';

export function useChatLayoutShortcuts({
  threads,
  threadsOpen,
  onThreadsOpenChange,
  details,
  detailsOpen,
  onDetailsOpenChange,
}: Pick<
  ChatLayoutViewProps,
  'threads' | 'threadsOpen' | 'onThreadsOpenChange' | 'details' | 'detailsOpen' | 'onDetailsOpenChange'
>) {
  const bindings: Record<string, () => void> = {};
  if (threads && onThreadsOpenChange) bindings[CHAT_LAYOUT_SHORTCUTS.threads] = () => onThreadsOpenChange(!threadsOpen);
  if (details) bindings[CHAT_LAYOUT_SHORTCUTS.details] = () => onDetailsOpenChange(!detailsOpen);
  useKeydown(bindings, { repeat: false });
}
