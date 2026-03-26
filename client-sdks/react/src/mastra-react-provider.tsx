import type { MastraClientProviderProps } from '@/mastra-client-context';
import { MastraClientProvider } from '@/mastra-client-context';
type MastraReactProviderProps = MastraClientProviderProps;

export const MastraReactProvider = ({
  children,
  baseUrl,
  headers,
  apiPrefix,
  telemetryBaseUrl,
}: MastraReactProviderProps) => {
  return (
    <MastraClientProvider baseUrl={baseUrl} headers={headers} apiPrefix={apiPrefix} telemetryBaseUrl={telemetryBaseUrl}>
      {children}
    </MastraClientProvider>
  );
};
