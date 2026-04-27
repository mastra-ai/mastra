import { useEffect, useEffectEvent } from 'react';

interface UseInitialMessageArgs {
  initialUserMessage?: string;
  toolsReady: boolean;
  isConversationLoading: boolean;
  hasExistingConversation: boolean;
  onSend: (message: string) => void;
}

export const useInitialMessage = ({
  initialUserMessage,
  toolsReady,
  isConversationLoading,
  hasExistingConversation,
  onSend,
}: UseInitialMessageArgs) => {
  const effectEvent = useEffectEvent(() => {
    if (!initialUserMessage) return;
    if (isConversationLoading) return;
    if (hasExistingConversation) return;

    onSend(initialUserMessage);
  });

  useEffect(() => {
    if (!toolsReady) return;
    if (isConversationLoading) return;
    if (hasExistingConversation) return;

    effectEvent();
  }, [toolsReady, initialUserMessage, isConversationLoading, hasExistingConversation]);
};
