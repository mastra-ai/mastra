import { useEffect, useEffectEvent, useRef } from 'react';

interface UseInitialMessageArgs {
  initialUserMessage?: string;
  toolsReady: boolean;
  onSend: (message: string) => void;
}

export const useInitialMessage = ({ initialUserMessage, toolsReady, onSend }: UseInitialMessageArgs) => {
  const hasAlreadySent = useRef(false);

  const effectEvent = useEffectEvent(() => {
    if (!initialUserMessage) return;
    onSend(initialUserMessage);
  });

  useEffect(() => {
    if (!toolsReady) return;
    if (hasAlreadySent.current) return;
    hasAlreadySent.current = true;

    effectEvent();
    window.history.replaceState({}, '');
  }, [toolsReady]);
};
