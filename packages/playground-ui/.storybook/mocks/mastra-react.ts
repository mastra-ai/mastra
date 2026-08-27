import type { ReactNode } from 'react';

interface MastraReactProviderProps {
  children: ReactNode;
}

const client = {
  options: {
    baseUrl: 'http://localhost:4111',
    apiPrefix: '/api',
  },
};

export function MastraReactProvider({ children }: MastraReactProviderProps) {
  return children;
}

export function useMastraClient() {
  return client;
}
