import { AlertCircle } from 'lucide-react';

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
    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
        <div className="text-sm text-yellow-800 dark:text-yellow-200">
          <div className="font-medium">Provider not connected</div>
          <div className="text-xs mt-1">
            Set the{' '}
            <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
              {envVar || `${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`}
            </code>{' '}
            environment variable to use this provider.
          </div>
        </div>
      </div>
    </div>
  );
};
