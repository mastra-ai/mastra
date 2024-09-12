'use client';

import type { IntegrationCredentialType } from '@arkw/core';
import React from 'react';

import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import { Icon } from '@/app/components/icon';
import { ReferenceDialog } from '@/domains/integrations/components/reference-dialog';

interface ConnectButtonProps {
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

export const ConnectButton = ({ authType, getOAuthConnectionRoute, integrationName }: ConnectButtonProps) => {
  const router = useRouter();
  const [referenceId, setReferenceId] = React.useState('');

  const handleConnect = async (refId: string) => {
    const oauthConnectionRoute = await getOAuthConnectionRoute({
      name: String(integrationName).toUpperCase(),
      referenceId: refId,
    });
    if (oauthConnectionRoute && authType === 'OAUTH') {
      return router.push(oauthConnectionRoute);
    }
    // TODO: handle API_KEY connection when we have it
    // router.push(`/setup/${integrationName}/success?referenceId=${refId}`);
  };

  return (
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
  );
};
