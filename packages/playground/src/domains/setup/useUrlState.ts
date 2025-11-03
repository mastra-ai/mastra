import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useState } from 'react';

const useIsMastraRunning = () => {
  return useQuery({
    queryKey: ['is-mastra-running'],
    queryFn: () => {
      return fetch('http://localhost:4111').then(res => res.ok);
    },
    retry: false,
  });
};

export const useUrlState = () => {
  const { data: isMastraRunning, isLoading: isLoadingMastraRunning } = useIsMastraRunning();
  const [urlState, setUrlState] = useState<{ url: string; isLoading: boolean }>({ url: '', isLoading: true });

  useLayoutEffect(() => {
    const storedUrl = localStorage.getItem('mastra-instance-url');
    if (storedUrl) return setUrlState({ url: storedUrl, isLoading: false });

    if (isMastraRunning) {
      return setUrlState({ url: 'http://localhost:4111', isLoading: false });
    }

    return setUrlState({ url: '', isLoading: false });
  }, [isMastraRunning]);

  const setUrl = (url: string) => {
    setUrlState({ url, isLoading: false });
    localStorage.setItem('mastra-instance-url', url);
  };

  return { ...urlState, setUrl, isLoading: isLoadingMastraRunning || urlState.isLoading };
};
