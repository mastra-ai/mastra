import { useParams } from 'react-router';

import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';

export function usePreparingThreadId(): string | null {
  const { sessionEnabled } = useChatSessionContext();
  const { status } = useChatConnection();
  const { threadId } = useParams<{ threadId: string }>();
  return threadId && sessionEnabled && status === 'connecting' ? threadId : null;
}
