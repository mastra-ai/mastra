import { MastraClient } from '@mastra/client-js';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

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

const IPV4_LOOPBACK_RE = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isIPv4Loopback = (hostname: string): boolean => {
  const m = IPV4_LOOPBACK_RE.exec(hostname);
  if (!m) return false;
  return +m[1]! <= 255 && +m[2]! <= 255 && +m[3]! <= 255;
};

export const isLocalUrl = (url?: string): boolean => {
  if (!url) return true;
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      isIPv4Loopback(hostname) ||
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
