import { MastraClientProvider, MastraClientProviderProps } from '@/mastra-client-context';
type MastraReactProviderProps = MastraClientProviderProps;

export const MastraReactProvider = ({ children, baseUrl, headers, apiPrefix }: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix}>
      {children}
    </MastraClientProvider>
  );
};
