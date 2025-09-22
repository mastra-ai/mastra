import { QueryClientProvider, QueryClientProviderProps } from '@/query-client-provider';
import { MastraClientProvider, MastraClientProviderProps } from '@/mastra-client-context';

export type MastraReactProviderProps = QueryClientProviderProps & MastraClientProviderProps;

export const MastraReactProvider = ({ children, config, baseUrl, headers }: MastraReactProviderProps) => {
  return (
    <QueryClientProvider config={config}>
      <MastraClientProvider baseUrl={baseUrl} headers={headers}>
        {children}
      </MastraClientProvider>
    </QueryClientProvider>
  );
};
