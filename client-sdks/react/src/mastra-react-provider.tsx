import { MastraClientProvider, MastraClientProviderProps } from '@/mastra-client-context';
type MastraReactProviderProps = MastraClientProviderProps;

export const MastraReactProvider = ({ children, baseUrl, headers }: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers}>
      {children}
    </MastraClientProvider>
  );
};
