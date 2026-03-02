import { createContext, useContext, ReactNode } from 'react';
import { MastraClient } from '@mastra/client-js';

export type MastraClientContextType = MastraClient;

const MastraClientContext = createContext<MastraClientContextType>({} as MastraClientContextType);

export interface MastraClientProviderProps {
  children: ReactNode;
  baseUrl?: string;
  headers?: Record<string, string>;
  /** API route prefix. Defaults to '/api'. Set this to match your server's apiPrefix configuration. */
  apiPrefix?: string;
}

export const MastraClientProvider = ({ children, baseUrl, headers, apiPrefix }: MastraClientProviderProps) => {
  const client = createMastraClient(baseUrl, headers, apiPrefix);

  return <MastraClientContext.Provider value={client}>{children}</MastraClientContext.Provider>;
};

export const useMastraClient = () => useContext(MastraClientContext);

export const isLocalUrl = (url?: string): boolean => {
  if (!url) return true;
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.startsWith('127.') ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
};

const createMastraClient = (baseUrl?: string, mastraClientHeaders: Record<string, string> = {}, apiPrefix?: string) => {
  return new MastraClient({
    baseUrl: baseUrl || '',
    headers: isLocalUrl(baseUrl) ? { ...mastraClientHeaders, 'x-mastra-dev-playground': 'true' } : mastraClientHeaders,
    apiPrefix,
  });
};
