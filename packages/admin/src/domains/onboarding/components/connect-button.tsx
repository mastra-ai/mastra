'use client';

import type { Credential, IntegrationCredentialType } from '@kpl/core';
import React from 'react';

import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import { capitalizeFirstLetter } from '@/lib/string';
import { toast } from '@/lib/toast';

import { connectIntegrationByAPIKey } from '@/app/(dashboard)/integrations/actions';
import { Icon } from '@/app/components/icon';
import { IntegrationConnectDialog } from '@/domains/integrations/components/integration-connect-dialog';
import { ReferenceDialog } from '@/domains/integrations/components/reference-dialog';
import { ApiKeyConfigProps } from '@/domains/integrations/types';

interface ConnectButtonProps {
  apiKeyConfig: ApiKeyConfigProps;
  authType: IntegrationCredentialType | undefined;
  getOAuthConnectionRoute: ({
    name,
    referenceId,
  }: {
    name: string;
    referenceId: string;
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
  const [referenceId, setReferenceId] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);

  const handleConnect = async (refId: string) => {
    const oauthConnectionRoute = await getOAuthConnectionRoute({
      name: String(integrationName).toUpperCase(),
      referenceId: refId,
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
        referenceId,
      });
      if (error) {
        toast.error(error);
      }
      router.push(`/setup/${integrationName.toLowerCase()}/success?referenceId=${referenceId}`);
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
          <button className="text-xs flex gap-1.5 p-2.5 items-center hover:bg-kpl-bg-2/50 transition-colors duration-150 border border-kpl-border-2/70 rounded-md">
            <Icon name="plus-icon" />
            <span className="mt-0.5">Connect Account</span>
          </button>
        </DialogTrigger>
        <DialogContent>
          <ReferenceDialog setReferenceId={setReferenceId} handleConnect={handleConnect} />
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
