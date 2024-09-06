'use client';

import React from 'react';

import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import { Icon } from '@/app/components/icon';
import { ReferenceDialog } from '@/domains/integrations/components/reference-dialog';

interface ConnectButtonProps {
  getOAuthConnectionRoute: ({
    name,
    referenceId,
  }: {
    name: string;
    referenceId: string;
  }) => Promise<string | undefined>;
  integrationName: string;
}

export const ConnectButton = ({ getOAuthConnectionRoute, integrationName }: ConnectButtonProps) => {
  const router = useRouter();
  const [referenceId, setReferenceId] = React.useState('');

  const handleConnect = async (refId: string) => {
    const oauthConnectionRoute = await getOAuthConnectionRoute({
      name: String(integrationName).toUpperCase(),
      referenceId: refId,
    });
    if (oauthConnectionRoute) {
      return router.push(oauthConnectionRoute);
    }
    router.push(`/setup/${integrationName}/success?referenceId=${referenceId}`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-xs flex gap-1.5 p-2.5 items-center hover:bg-arkw-bg-2/50 transition-colors duration-150 border border-arkw-border-2/70 rounded-md">
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
