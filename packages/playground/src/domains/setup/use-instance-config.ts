import { useQuery } from '@tanstack/react-query';
import { useLayoutEffect, useState } from 'react';
import { MastraInstanceConfig } from './MastraInstanceUrlContext';

const useIsMastraRunning = () => {
  return useQuery({
    queryKey: ['is-mastra-running'],
    queryFn: () => {
      return fetch('http://localhost:4111')
        .then(res => res.ok)
        .catch(() => false);
    },
    retry: false,
  });
};

export const useInstanceConfig = () => {
  const { data: isMastraRunning, isLoading: isLoadingMastraRunning } = useIsMastraRunning();
  const [config, setConfig] = useState<MastraInstanceConfig & { isLoading: boolean }>({
    url: '',
    headers: [],
    isLoading: true,
  });

  useLayoutEffect(() => {
    const storedConfig = localStorage.getItem('mastra-instance-config');
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);

      if (parsedConfig.url) {
        setConfig({ ...parsedConfig, isLoading: false });
      }
    }

    if (isMastraRunning) {
      return setConfig({ url: 'http://localhost:4111', headers: [], isLoading: false });
    }

    return setConfig({ url: '', headers: [], isLoading: false });
  }, [isMastraRunning]);

  const doSetConfig = (nextConfig: MastraInstanceConfig) => {
    setConfig({ ...nextConfig, isLoading: false });
    localStorage.setItem('mastra-instance-config', JSON.stringify(nextConfig));
  };

  const { isLoading, ...currentConfig } = config;
  const formattedHeaders: Record<string, string> = currentConfig.headers.reduce(
    (acc, header) => ({
      ...acc,
      [header.name]: header.value,
    }),
    {},
  );

  return {
    config: currentConfig,
    setConfig: doSetConfig,
    isLoading: isLoadingMastraRunning || config.isLoading,
    formattedHeaders,
  };
};
