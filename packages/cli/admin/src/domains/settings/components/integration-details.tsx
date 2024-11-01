'use client';

import { Icon } from '@/components/icon';
import MultiSelect from '@/components/multi-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/ui/spinner';

import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';

import { IntegrationLogo } from '@/domains/integrations/components/integration-logo';
import { useIntegrationDetails } from '@/domains/integrations/hooks/use-integration';

import isEqual from 'lodash/isEqual';
import last from 'lodash/last';

export const IntegrationDetails = ({ integrationName }: { integrationName: string }) => {
  const {
    integration,
    loading,
    updateClientId,
    updateClientSecret,
    updateScopes,
    saveIntegration,
    saving,
    credential,
  } = useIntegrationDetails({
    name: integrationName,
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-[2px]">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="space-y-[19px]">
          <div className="flex gap-10">
            <Skeleton className="h-[11px] w-[71px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <div className="flex gap-10">
            <Skeleton className="h-[11px] w-[71px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <div className="flex gap-10">
            <Skeleton className="h-[11px] w-[71px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <div className="flex gap-10">
            <Skeleton className="h-[11px] w-[71px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
          <div className="flex gap-10">
            <Skeleton className="h-[11px] w-[71px]" />
            <Skeleton className="h-3 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }
  if (!integration) {
    return <></>;
  }
  const firstConnection = last(integration.connections);

  const { clientID, clientSecret, scopes } = integration;

  const isEditing = !isEqual({ clientID, clientSecret, scopes }, credential);
  return (
    <ScrollArea>
      <div className="space-y-8 h-full">
        <div className="flex items-center gap-4">
          <IntegrationLogo name={integration.name} logoUrl={integration.logoUrl} imageSize={25} />
          <div className="space-y-[2px]">
            <h2 className="text-mastra-el-6 text-2xl font-medium capitalize">
              {integration.name?.toLocaleLowerCase()}
            </h2>
            <p className="text-[#808182] text-xs font-medium">
              {firstConnection
                ? `Connected on ${formatDate(firstConnection.createdAt, { year: 'numeric' })}`
                : 'Not connected'}
            </p>
          </div>

          {isEditing ? (
            <Button
              type="button"
              onClick={() => saveIntegration()}
              variant={'secondary'}
              className={cn('w-7 h-7 bg-mastra-bg-accent border border-mastra-border-2 p-0 absolute top-1 right-3')}
            >
              {saving ? <Spinner /> : <Icon name="check" className="text-white " />}
            </Button>
          ) : null}
        </div>
        <div className="space-y-[19px]">
          <div className="flex gap-10">
            <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">API Provider</p>
            <p className="text-mastra-el-5 text-xs font-medium capitalize">{integration.name?.toLocaleLowerCase()}</p>
          </div>
          <div className="flex gap-10">
            <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Integration ID</p>
            <p className="text-mastra-el-5 text-xs font-medium">{integration.name}</p>
          </div>
          <div className="flex gap-10">
            <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Auth Type</p>
            <p className="text-mastra-el-5 text-xs font-medium">{integration.authType}</p>
          </div>
          <div className="flex gap-10">
            <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Redirect URI</p>
            <p className="text-mastra-el-5 text-xs font-medium">{integration.redirectUri}</p>
          </div>
          {integration.authType === 'API_KEY' ? undefined : (
            <>
              <div className="flex gap-10">
                <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Client ID</p>
                <Input
                  value={credential.clientID}
                  onChange={e => {
                    updateClientId(e.target.value);
                  }}
                  className="text-mastra-el-5 text-xs font-medium p-0 h-[unset]"
                  placeholder="Set Client ID"
                  variant="unstyled"
                />
              </div>
              <div className="flex gap-10">
                <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Client Secret</p>
                <Input
                  value={credential.clientSecret}
                  type="password"
                  onChange={e => {
                    updateClientSecret(e.target.value);
                  }}
                  className="text-mastra-el-5 text-xs font-medium p-0 h-[unset]"
                  placeholder="Set Client Secret"
                  variant="unstyled"
                />
              </div>
            </>
          )}
          <div className="flex gap-10">
            <p className="text-mastra-el-3 text-[11px] w-[71px] min-w-[71px]">Scopes</p>
            <MultiSelect
              fieldName="Scope"
              options={integration.availableScopes.map(scope => ({
                label: `${scope.key} - ${scope.description}`,
                value: scope.key,
              }))}
              selected={credential.scopes || []}
              onSelect={selected => {
                updateScopes(selected.value);
              }}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
