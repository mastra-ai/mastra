import { MastraClientProvider, MastraClientProviderProps } from '@/mastra-client-context';
type MastraReactProviderProps = MastraClientProviderProps;

export const MastraReactProvider = ({ children, baseUrl, headers, prefix }: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers} prefix={prefix}>
      {children}
    </MastraClientProvider>
  );
};
