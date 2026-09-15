import type { Provider } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui/components/Notice';

export interface ProviderNotConnectedAlertProps {
  provider: Provider;
}

export const ProviderNotConnectedAlert = ({ provider }: ProviderNotConnectedAlertProps) => {
  if (provider.connected) {
    return null;
  }

  return (
    <div className="p-2 pt-2">
      <Notice variant="warning" title="Provider not connected">
        <Notice.Message>
          Set the{' '}
          <code className="rounded bg-yellow-100 px-1 py-0.5 dark:bg-yellow-900/50">
            {Array.isArray(provider.envVar) ? provider.envVar.join(', ') : provider.envVar}
          </code>{' '}
          environment {Array.isArray(provider.envVar) && provider.envVar.length > 1 ? 'variables' : 'variable'} to use
          this provider.
        </Notice.Message>
      </Notice>
    </div>
  );
};
