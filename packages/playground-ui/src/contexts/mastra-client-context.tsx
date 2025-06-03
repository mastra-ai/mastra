import React, { createContext, useContext, ReactNode } from 'react';
import { MastraClient } from '@mastra/client-js';
import { createMastraClient } from '@/lib/mastra-client';

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
