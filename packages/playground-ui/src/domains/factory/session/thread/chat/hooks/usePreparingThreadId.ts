import { useSessionHost } from '../context/SessionHostContext';

import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';

export function usePreparingThreadId(): string | null {
  const { sessionEnabled } = useChatSessionContext();
  const { status } = useChatConnection();
  const { threadId } = useSessionHost();
  return threadId && sessionEnabled && status === 'connecting' ? threadId : null;
}
