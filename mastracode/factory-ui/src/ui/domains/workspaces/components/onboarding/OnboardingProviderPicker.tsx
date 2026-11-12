import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronsUpDown, Plug, Plus } from 'lucide-react';
import { useState } from 'react';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ProviderInfo } from '../../../../../api/types';
import { CustomProviderForm } from '../../../settings/components/CustomProviderForm';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import { CONNECTION_METHOD_LABEL, matchesProviderQuery } from '../../hooks/useProviderConnection';
import type { PreviewProvider, ProviderConnectionMethod } from '../../hooks/useProviderConnection';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
import { OnboardingProviderOption } from './OnboardingProviderOption';
import { OnboardingProviderOptions } from './OnboardingProviderOptions';
import { OnboardingProviderSummary } from './OnboardingProviderSummary';

/**
 * A lane's own provider as one row that opens a searchable list: a switch between API-key providers
 * (plus a custom provider) and subscriptions you sign in to. The list only shows while choosing, so
 * the lane stays one line plus its model.
 */
export function OnboardingProviderPicker({
  lane,
  onPreviewProvider,
}: {
  lane: OnboardingModelLane;
  onPreviewProvider: PreviewProvider;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<ProviderConnectionMethod>('api_key');
  const [addingCustom, setAddingCustom] = useState(false);
  const { connection, connectedProvider } = lane;

  const close = () => {
    setOpen(false);
    setSearch('');
  };
  const restorePreview = () => onPreviewProvider(connection.provider?.provider, connection.method);
  const pick = (provider: ProviderInfo, method: ProviderConnectionMethod) => {
    close();
    onPreviewProvider(provider.provider, method);
    // A sign-in that fails to start leaves the lane as it was, so the preview goes back with it.
    if (method === 'oauth') connection.chooseSignInProvider(provider, restorePreview);
    else connection.chooseKeyProvider(provider);
  };
  const keyProviders = connection.keyProviders.filter(provider => matchesProviderQuery(provider, search));
  const signInProviders = connection.signInProviders.filter(provider => matchesProviderQuery(provider, search));
  const offersSignIn = connection.signInProviders.length > 0;
  const query = search.trim();
  const matches = { api_key: keyProviders.length, oauth: signInProviders.length };
  const otherTab = tab === 'api_key' ? 'oauth' : 'api_key';
  // A search with no match in this tab but some in the other shows the other, so a match is never hidden.
  const shownTab = query && matches[tab] === 0 && matches[otherTab] > 0 ? otherTab : tab;
  const unmatchedQuery = query && matches.api_key + matches.oauth === 0 ? query : undefined;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={next => {
          if (!next) {
            close();
            restorePreview();
            return;
          }
          setTab(connection.method ?? (connection.keyProviders.length === 0 && offersSignIn ? 'oauth' : 'api_key'));
          setOpen(true);
        }}
      >
        <PopoverTrigger
          aria-label={
            connectedProvider ? `Provider: ${providerDisplayName(connectedProvider.provider)}` : 'Choose a provider'
          }
          // A plain button rather than the DS `Button`: that one is a fixed-height, single-line pill, and this
          // trigger is the lane's two-line provider summary at full width.
          render={
            <button
              type="button"
              className={cn(
                '-m-2 flex min-w-0 cursor-pointer items-start gap-3 rounded-md p-2 text-start hover:bg-fill-subtle',
                focusRingInset,
              )}
            />
          }
        >
          <OnboardingProviderSummary
            icon={
              connectedProvider ? (
                <ProviderBrandIcon provider={connectedProvider.provider} />
              ) : (
                <Plug aria-hidden="true" />
              )
            }
            title={connectedProvider ? providerDisplayName(connectedProvider.provider) : 'Choose a provider'}
            meta={
              connectedProvider ? (
                <Metadata>
                  <Metadata.Item>Connected</Metadata.Item>
                  {connection.method && <Metadata.Item>{CONNECTION_METHOD_LABEL[connection.method]}</Metadata.Item>}
                </Metadata>
              ) : (
                'An API key, a subscription, or a custom provider'
              )
            }
          />
          <span className="text-muted-foreground flex h-5 shrink-0 items-center [&_svg]:size-4">
            <ChevronsUpDown aria-hidden="true" />
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-(--anchor-width) min-w-80 flex-col gap-1 p-1"
          onMouseLeave={restorePreview}
        >
          <SearchInput
            label="Search model providers"
            placeholder="Search providers"
            value={search}
            onValueChange={setSearch}
          />
          {offersSignIn && !unmatchedQuery && (
            <SegmentedControl
              aria-label="Connection type"
              size="sm"
              value={shownTab}
              onValueChange={setTab}
              className="mx-1 my-1 w-auto"
            >
              <SegmentedControlItem value="api_key" className="min-w-0 flex-1">
                API key
              </SegmentedControlItem>
              <SegmentedControlItem value="oauth" className="min-w-0 flex-1">
                Subscription
              </SegmentedControlItem>
            </SegmentedControl>
          )}
          <OnboardingProviderOptions
            lane={lane}
            method={shownTab}
            providers={shownTab === 'api_key' ? keyProviders : signInProviders}
            unmatchedQuery={unmatchedQuery}
            onPreviewProvider={onPreviewProvider}
            onPick={pick}
          />
          {shownTab === 'api_key' && (
            <OnboardingProviderOption
              icon={<Plus aria-hidden="true" />}
              title="Add a custom provider"
              // A sign-in still starting would open its dialog over this one.
              disabled={connection.pending}
              onClick={() => {
                close();
                // Closing programmatically skips onOpenChange, so the hovered provider's preview stays otherwise.
                restorePreview();
                setAddingCustom(true);
              }}
            />
          )}
        </PopoverContent>
      </Popover>
      <Dialog open={addingCustom} onOpenChange={setAddingCustom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a custom provider</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <CustomProviderForm
              requireModels
              onCancel={() => setAddingCustom(false)}
              onSaved={provider => {
                setAddingCustom(false);
                connection.chooseCustomProvider(provider.id);
                onPreviewProvider(provider.id, 'api_key');
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}
