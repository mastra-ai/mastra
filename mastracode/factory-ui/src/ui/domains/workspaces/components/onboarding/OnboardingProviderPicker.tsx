import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ChevronsUpDown, Plug, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ProviderInfo } from '../../../../../api/types';
import { CustomProviderForm } from '../../../settings/components/CustomProviderForm';
import type { OnboardingModelLane } from '../../hooks/useOnboardingModelLane';
import { CONNECTION_METHOD_LABEL, matchesProviderQuery } from '../../hooks/useProviderConnection';
import type { PreviewProvider, ProviderConnectionMethod } from '../../hooks/useProviderConnection';
import { ProviderBrandIcon } from '../ProviderBrandIcon';
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
  const pick = (provider: ProviderInfo, method: ProviderConnectionMethod, connect: () => void) => {
    close();
    connect();
    onPreviewProvider(provider.provider, method);
  };
  const restorePreview = () => onPreviewProvider(connection.provider?.provider, connection.method);
  const keyProviders = connection.keyProviders.filter(provider => matchesProviderQuery(provider, search));
  const signInProviders = connection.signInProviders.filter(provider => matchesProviderQuery(provider, search));
  const offersSignIn = connection.signInProviders.length > 0;
  const query = search.trim();
  const matches = { api_key: keyProviders.length, oauth: signInProviders.length };
  const otherTab = tab === 'api_key' ? 'oauth' : 'api_key';
  // A search with no match in this tab but some in the other shows the other, so a match is never hidden.
  const shownTab = query && matches[tab] === 0 && matches[otherTab] > 0 ? otherTab : tab;
  const nothingMatches = Boolean(query) && matches.api_key + matches.oauth === 0;

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
          {offersSignIn && !nothingMatches && (
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
          {nothingMatches ? (
            <EmptyLine>{`No providers match “${query}”.`}</EmptyLine>
          ) : (
            <ScrollArea maxHeight="15rem">
              <ScrollAreaViewport className="overscroll-y-contain">
                {shownTab === 'api_key' ? (
                  <div role="group" aria-label="API key providers" className="flex flex-col">
                    {keyProviders.map(provider => (
                      <ProviderOption
                        key={provider.provider}
                        provider={provider.provider}
                        title={providerDisplayName(provider.provider)}
                        meta={connection.isConfigured(provider, 'api_key') ? 'Connected' : undefined}
                        selected={connectedProvider === provider && connection.method === 'api_key'}
                        disabled={connection.pending || !connection.canConfigure(provider, 'api_key')}
                        onPreview={() => onPreviewProvider(provider.provider, 'api_key')}
                        onClick={() => pick(provider, 'api_key', () => connection.chooseKeyProvider(provider))}
                      />
                    ))}
                    {connection.keyProviders.length === 0 && <EmptyLine>No API key providers available.</EmptyLine>}
                  </div>
                ) : (
                  <div role="group" aria-label="Sign in with a provider" className="flex flex-col">
                    {signInProviders.map(provider => (
                      <ProviderOption
                        key={provider.provider}
                        provider={provider.provider}
                        title={
                          connection.isConfigured(provider, 'oauth')
                            ? `Use ${providerDisplayName(provider.provider)} connection`
                            : `Continue with ${providerDisplayName(provider.provider)}`
                        }
                        selected={connectedProvider === provider && connection.method === 'oauth'}
                        disabled={connection.pending || !connection.canConfigure(provider, 'oauth')}
                        onPreview={() => onPreviewProvider(provider.provider, 'oauth')}
                        onClick={() => pick(provider, 'oauth', () => connection.chooseSignInProvider(provider))}
                      />
                    ))}
                  </div>
                )}
              </ScrollAreaViewport>
            </ScrollArea>
          )}
          {shownTab === 'api_key' && (
            <ProviderOption
              icon={<Plus aria-hidden="true" />}
              title="Add a custom provider"
              onClick={() => {
                close();
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

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <Txt variant="caption" tone="muted" className="px-2 py-1.5">
      {children}
    </Txt>
  );
}

/** One provider in the list: instant subtle hover like the repositories, a check on the lane's provider. */
function ProviderOption({
  provider,
  icon,
  title,
  meta,
  selected = false,
  onPreview,
  ...props
}: Omit<ComponentProps<'button'>, 'title'> & {
  provider?: string;
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  selected?: boolean;
  onPreview?: () => void;
}) {
  const metaId = useId();
  return (
    <button
      type="button"
      aria-label={title}
      aria-describedby={meta ? metaId : undefined}
      aria-current={selected || undefined}
      className={cn(
        'flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-start',
        'not-disabled:hover:bg-fill-subtle disabled:cursor-not-allowed disabled:opacity-50',
        focusRingInset,
      )}
      onMouseEnter={onPreview}
      onFocus={onPreview}
      {...props}
    >
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center [&_svg]:size-4">
        {provider ? <ProviderBrandIcon provider={provider} /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="label" className="truncate">
          {title}
        </Txt>
        {meta && (
          <Txt as="span" id={metaId} variant="meta" tone="muted" className="truncate">
            {meta}
          </Txt>
        )}
      </span>
      {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
    </button>
  );
}
