import type { Provider } from '@mastra/client-js';
import { Notice } from '@mastra/playground-ui';

export interface ProviderNotConnectedAlertProps {
  provider: Provider;
}

export const ProviderNotConnectedAlert = ({ provider }: ProviderNotConnectedAlertProps) => {
  if (provider.connected) {
    return null;
  }

  return (
    <div className="pt-2 p-2">
      <Notice variant="warning" title="Provider not connected">
        <Notice.Message>
          Set the{' '}
          <code className="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded">
            {Array.isArray(provider.envVar) ? provider.envVar.join(', ') : provider.envVar}
          </code>{' '}
          environment {Array.isArray(provider.envVar) && provider.envVar.length > 1 ? 'variables' : 'variable'} to use
          this provider.
        </Notice.Message>
      </Notice>
    </div>
  );
};
