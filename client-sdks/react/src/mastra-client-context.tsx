import { createContext, useContext, ReactNode } from 'react';
import { MastraClient } from '@mastra/client-js';

export type MastraClientContextType = MastraClient;

const MastraClientContext = createContext<MastraClientContextType>({} as MastraClientContextType);

export interface MastraClientProviderProps {
  children: ReactNode;
  baseUrl?: string;
  headers?: Record<string, string>;
  /** API route prefix. Defaults to '/api'. Set this to match your server's prefix configuration. */
  prefix?: string;
}

export const MastraClientProvider = ({ children, baseUrl, headers, prefix }: MastraClientProviderProps) => {
  const client = createMastraClient(baseUrl, headers, prefix);

  return <MastraClientContext.Provider value={client}>{children}</MastraClientContext.Provider>;
};

export const useMastraClient = () => useContext(MastraClientContext);

const createMastraClient = (baseUrl?: string, mastraClientHeaders: Record<string, string> = {}, prefix?: string) => {
  return new MastraClient({
    baseUrl: baseUrl || '',
    // only add the header if the baseUrl is not provided i.e it's a local dev environment
    headers: !baseUrl ? { ...mastraClientHeaders, 'x-mastra-dev-playground': 'true' } : mastraClientHeaders,
    prefix,
  });
};
