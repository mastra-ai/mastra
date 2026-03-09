import type { MastraClientProviderProps } from '@/mastra-client-context';
import { MastraClientProvider } from '@/mastra-client-context';
type MastraReactProviderProps = MastraClientProviderProps;

export const MastraReactProvider = ({ children, baseUrl, headers, apiPrefix }: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix}>
      {children}
    </MastraClientProvider>
  );
};
