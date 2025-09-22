import { MastraClientProvider, MastraClientProviderProps } from '@/mastra-client-context';
import { QueryClientProviderProps } from '@/query-client-provider';

export type MastraReactProviderProps = QueryClientProviderProps & MastraClientProviderProps;

export const MastraReactProvider = ({ children, config, baseUrl, headers }: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers}>
      {children}
    </MastraClientProvider>
  );
};
