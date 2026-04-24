import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

type StarterLocationState = { userMessage?: string } | null;

export const useStarterUserMessage = (): string | undefined => {
  const location = useLocation();

  const [userMessage] = useState<string | undefined>(() => (location.state as StarterLocationState)?.userMessage);

  useEffect(() => {
    if (userMessage === undefined) return;
    window.history.replaceState({}, '');
  }, [userMessage]);

  return userMessage;
};
