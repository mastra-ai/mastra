import { useEffect, useEffectEvent } from 'react';

interface UseInitialMessageArgs {
  initialUserMessage?: string;
  toolsReady: boolean;
  onSend: (message: string) => void;
}

export const useInitialMessage = ({ initialUserMessage, toolsReady, onSend }: UseInitialMessageArgs) => {
  const effectEvent = useEffectEvent(() => {
    if (!initialUserMessage) return;

    onSend(initialUserMessage);
  });

  useEffect(() => {
    if (!toolsReady) return;

    effectEvent();
  }, [toolsReady, initialUserMessage]);
};
