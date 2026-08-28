import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';

import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { providerDisplayName } from '../../../settings/components/provider-display-name';
import type { ProviderConnection } from '../../hooks/useProviderConnection';
import { isProviderConfigured, matchesProviderQuery } from '../../hooks/useProviderConnection';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
import { CreateFactoryPaletteAlert, CreateFactoryPaletteMessage } from './CreateFactoryPalette';

export interface CreateFactoryProviderRowsProps {
  connection: ProviderConnection;
  query: string;
  error?: string;
}

export function CreateFactoryProviderRows({ connection, query, error }: CreateFactoryProviderRowsProps) {
  if (connection.isPending) {
    return <SkeletonRows label="Loading model providers" rows={3} rowClassName="mx-2 my-1 h-12 rounded-xl" />;
  }
  if (connection.catalogError)
    return <CreateFactoryPaletteAlert>{connection.catalogError.message}</CreateFactoryPaletteAlert>;

  const signIn = connection.signInProviders.filter(provider => matchesProviderQuery(provider, query));
  const withKey = connection.keyProviders.filter(provider => matchesProviderQuery(provider, query));

  return (
    <>
      {error && <CreateFactoryPaletteAlert>{error}</CreateFactoryPaletteAlert>}
      {signIn.length === 0 && withKey.length === 0 && (
        <CreateFactoryPaletteMessage>No providers match this search.</CreateFactoryPaletteMessage>
      )}
      {signIn.length > 0 && (
        <CommandGroup heading="Sign in">
          {signIn.map(provider => (
            <CommandPaletteItem
              key={provider.provider}
              icon={<ProviderBrandIcon provider={provider.provider} />}
              title={providerDisplayName(provider.provider)}
              subtitle={isProviderConfigured(provider) ? 'Signed in on this deployment' : 'Sign in with your account'}
              badge={isProviderConfigured(provider) ? 'Connected' : undefined}
              value={`signin-${provider.provider}`}
              disabled={connection.pending}
              onSelect={() => connection.chooseSignInProvider(provider)}
            />
          ))}
        </CommandGroup>
      )}
      {withKey.length > 0 && (
        <CommandGroup heading="API key">
          {withKey.map(provider => (
            <CommandPaletteItem
              key={provider.provider}
              icon={<ProviderBrandIcon provider={provider.provider} />}
              title={providerDisplayName(provider.provider)}
              subtitle={isProviderConfigured(provider) ? 'API key saved' : 'Connect with an API key'}
              badge={isProviderConfigured(provider) ? 'Connected' : undefined}
              value={`key-${provider.provider}`}
              disabled={connection.pending}
              onSelect={() => connection.chooseKeyProvider(provider)}
            />
          ))}
        </CommandGroup>
      )}
    </>
  );
}
