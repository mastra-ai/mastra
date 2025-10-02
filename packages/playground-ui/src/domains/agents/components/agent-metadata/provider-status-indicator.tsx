import { Alert, AlertDescription, AlertTitle } from '@/ds/components/Alert';

interface ProviderStatusIndicatorProps {
  providerId: string;
  connected: boolean;
  envVar?: string;
}

export const ProviderStatusIndicator = ({ providerId, connected, envVar }: ProviderStatusIndicatorProps) => {
  if (connected) {
    return null;
  }

  return (
    <div className="pt-2">
      <Alert variant="warning">
        <AlertTitle as="h5">Provider not connected</AlertTitle>
        <AlertDescription as="p">
          Set the{' '}
          <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
            {envVar || `${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`}
          </code>{' '}
          environment variable to use this provider.
        </AlertDescription>
      </Alert>
    </div>
  );
};
