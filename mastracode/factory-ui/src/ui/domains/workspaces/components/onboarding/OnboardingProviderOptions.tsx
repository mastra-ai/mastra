import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ProviderInfo } from '../../../../../api/types';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import type { PreviewProvider, ProviderConnection, ProviderConnectionMethod } from '../../hooks/useProviderConnection';
import { OnboardingProviderOption } from './OnboardingProviderOption';

const GROUP_LABELS: Record<ProviderConnectionMethod, string> = {
  api_key: 'API key providers',
  oauth: 'Sign in with a provider',
};

function optionTitle(connection: ProviderConnection, provider: ProviderInfo, method: ProviderConnectionMethod) {
  const name = providerDisplayName(provider.provider);
  if (method === 'api_key') return name;
  return connection.isConfigured(provider, 'oauth') ? `Use ${name} connection` : `Continue with ${name}`;
}

/**
 * The providers of the open tab, already filtered by the search. A member can't connect new providers to
 * the company account, so those rows stay visible but disabled, and one line under the list says why.
 */
export function OnboardingProviderOptions({
  lane,
  method,
  providers,
  unmatchedQuery,
  onPreviewProvider,
  onPick,
}: {
  lane: OnboardingModelLane;
  method: ProviderConnectionMethod;
  providers: ProviderInfo[];
  /** The trimmed search when it matches nothing in either tab. */
  unmatchedQuery?: string;
  onPreviewProvider: PreviewProvider;
  onPick: (provider: ProviderInfo, method: ProviderConnectionMethod) => void;
}) {
  const { connection, connectedProvider } = lane;
  const reasonId = useId();

  if (unmatchedQuery) return <EmptyLine>{`No providers match “${unmatchedQuery}”.`}</EmptyLine>;

  const adminOnly = providers.some(provider => !connection.canConfigure(provider, method));
  const noneOffered = method === 'api_key' && connection.keyProviders.length === 0;
  return (
    <>
      <ScrollArea maxHeight="15rem">
        <ScrollAreaViewport className="overscroll-y-contain">
          <div role="group" aria-label={GROUP_LABELS[method]} className="flex flex-col">
            {providers.map(provider => {
              const allowed = connection.canConfigure(provider, method);
              const connectedByKey = method === 'api_key' && connection.isConfigured(provider, 'api_key');
              return (
                <OnboardingProviderOption
                  key={provider.provider}
                  provider={provider.provider}
                  title={optionTitle(connection, provider, method)}
                  meta={connectedByKey ? 'Connected' : undefined}
                  reasonId={allowed ? undefined : reasonId}
                  selected={connectedProvider === provider && connection.method === method}
                  disabled={connection.pending || !allowed}
                  onPreview={() => onPreviewProvider(provider.provider, method)}
                  onClick={() => onPick(provider, method)}
                />
              );
            })}
            {noneOffered && <EmptyLine>No API key providers available.</EmptyLine>}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
      {adminOnly && (
        <Txt id={reasonId} variant="meta" tone="muted" className="px-2 py-1.5">
          Only an organization admin can connect other providers for the company account. Choose one that is already
          connected.
        </Txt>
      )}
    </>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <Txt variant="caption" tone="muted" className="px-2 py-1.5">
      {children}
    </Txt>
  );
}
