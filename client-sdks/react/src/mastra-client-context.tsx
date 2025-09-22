import { createContext, useContext, ReactNode } from 'react';
import { MastraClient } from '@mastra/client-js';

type MastraClientContextType = {
  client: MastraClient;
};

const MastraClientContext = createContext<MastraClientContextType | undefined>(undefined);

export const MastraClientProvider = ({
  children,
  baseUrl,
  headers,
}: {
  children: ReactNode;
  baseUrl?: string;
  headers?: Record<string, string>;
}) => {
  const client = createMastraClient(baseUrl, headers);

  return <MastraClientContext.Provider value={{ client }}>{children}</MastraClientContext.Provider>;
};

export const useMastraClient = () => {
  const context = useContext(MastraClientContext);
  if (context === undefined) {
    throw new Error('useMastraClient must be used within a MastraClientProvider');
  }

  return context.client;
};

const createMastraClient = (baseUrl?: string, mastraClientHeaders: Record<string, string> = {}) => {
  return new MastraClient({
    baseUrl: baseUrl || '',
    // only add the header if the baseUrl is not provided i.e it's a local dev environment
    headers: !baseUrl ? { ...mastraClientHeaders, 'x-mastra-dev-playground': 'true' } : mastraClientHeaders,
  });
};
