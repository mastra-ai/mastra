'use client';

import type { Credential, IntegrationCredentialType } from '@mastra/core';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React from 'react';

import { useRouter } from 'next/navigation';

import { Icon } from '@/components/icon';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { capitalizeFirstLetter } from '@/lib/string';
import { toast } from '@/lib/toast';

import { connectIntegrationByAPIKey } from '@/domains/integrations/actions';
import { IntegrationConnectDialog } from '@/domains/integrations/components/integration-connect-dialog';
import { ReferenceDialog } from '@/domains/integrations/components/reference-dialog';
import { ApiKeyConfigProps } from '@/domains/integrations/types';

interface ConnectButtonProps {
  apiKeyConfig: ApiKeyConfigProps;
  authType: IntegrationCredentialType | undefined;
  getOAuthConnectionRoute: ({
    name,
    connectionId,
  }: {
    name: string;
    connectionId: string;
  }) => Promise<string | undefined>;
  integrationName: string;
}

export const ConnectButton = ({
  authType,
  apiKeyConfig,
  getOAuthConnectionRoute,
  integrationName,
}: ConnectButtonProps) => {
  const router = useRouter();
  const [connectionId, setConnectionId] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleConnect = async (cId: string) => {
    const oauthConnectionRoute = await getOAuthConnectionRoute({
      name: String(integrationName).toUpperCase(),
      connectionId: cId,
    });
    if (oauthConnectionRoute && authType === 'OAUTH') {
      return router.push(oauthConnectionRoute);
    }
    setIsOpen(true);
  };

  const onManualConnect = async (credential: unknown) => {
    try {
      const error = await connectIntegrationByAPIKey({
        name: String(integrationName).toUpperCase(),
        credential: credential as Credential,
        connectionId,
      });
      if (error) {
        toast.error(error);
      }
      router.push(`/setup/${integrationName.toLowerCase()}/success?connectionId=${connectionId}`);
      toast.success(`Successfully connected ${capitalizeFirstLetter(integrationName)}`);
    } catch (err) {
      toast.error('Unable to connect to the Integration');
      console.error(err);
    }
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <button className="text-xs flex gap-1.5 p-2.5 items-center hover:bg-mastra-bg-2/50 transition-colors duration-150 border border-mastra-border-2/70 rounded-md">
            <Icon name="plus-icon" />
            <span className="mt-0.5">Connect Account</span>
          </button>
        </DialogTrigger>
        <DialogContent>
          <VisuallyHidden>
            <DialogTitle>Connect Account</DialogTitle>
          </VisuallyHidden>
          <ReferenceDialog setConnectionId={setConnectionId} handleConnect={handleConnect} />
        </DialogContent>
      </Dialog>

      <IntegrationConnectDialog
        connectOptions={apiKeyConfig}
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        onConnect={onManualConnect}
      />
    </>
  );
};
