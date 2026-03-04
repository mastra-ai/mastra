import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';
import { Provider } from '@mastra/client-js';

export interface ProviderNotConnectedAlertProps {
  provider: Provider;
}

export const ProviderNotConnectedAlert = ({ provider }: ProviderNotConnectedAlertProps) => {
  if (provider.connected) {
    return null;
  }

  return (
    <div className="pt-2 p-2">
      <Alert variant="warning">
        <AlertTitle as="h5">Provider not connected</AlertTitle>
        <AlertDescription as="p">
          Set the{' '}
          <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
            {Array.isArray(provider.envVar) ? provider.envVar.join(', ') : provider.envVar}
          </code>{' '}
          environment {Array.isArray(provider.envVar) && provider.envVar.length > 1 ? 'variables' : 'variable'} to use
          this provider.
        </AlertDescription>
      </Alert>
    </div>
  );
};
