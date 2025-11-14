import { createContext, useContext } from 'react';
import { useInstanceConfig } from './use-instance-config';

export type HeaderConfig = {
  name: string;
  value: string;
};

export type MastraInstanceConfig = {
  url: string;
  headers: HeaderConfig[];
};

export const MastraInstanceUrlContext = createContext<{
  config: MastraInstanceConfig;
  setConfig: (config: MastraInstanceConfig) => void;
  isLoading: boolean;
  formattedHeaders: Record<string, string>;
}>({
  config: { url: '', headers: [] },
  setConfig: () => {},
  isLoading: true,
  formattedHeaders: {},
});

export const MastraInstanceUrlProvider = ({ children }: { children: React.ReactNode }) => {
  const { config, setConfig, isLoading, formattedHeaders } = useInstanceConfig();

  return (
    <MastraInstanceUrlContext.Provider value={{ config, setConfig, isLoading, formattedHeaders }}>
      {children}
    </MastraInstanceUrlContext.Provider>
  );
};

export const useMastraInstanceConfig = () => {
  return useContext(MastraInstanceUrlContext);
};
