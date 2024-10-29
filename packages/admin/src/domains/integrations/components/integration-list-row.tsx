'use client';

import { Credential } from '@mastra/core';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import React, { useCallback, useState } from 'react';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { capitalizeFirstLetter } from '@/lib/string';
import { toast } from '@/lib/toast';

import { connectIntegrationByAPIKey } from '@/domains/integrations/actions';

import { IntegrationConnectDialog } from './integration-connect-dialog';
import { ReferenceDialog } from './reference-dialog';

interface IntegrationListRowProps {
  integrationName: string;
  imageSrc: string;
  getOAuthConnectionRoute: ({ name, connectionId }: { name: string; connectionId: string }) => string | undefined;
  isAPIKeyConnection?: boolean;
  APIKeyConnectOptions?: any;
}

export const IntegrationListRow = ({
  integrationName,
  imageSrc,
  getOAuthConnectionRoute,
  isAPIKeyConnection,
  APIKeyConnectOptions,
}: IntegrationListRowProps) => {
  const [connectionId, setConnectionId] = useState('');
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);

  const link = null;
  const viewRecords = () => {};

  const handleConnect = useCallback(
    async (connectionId: string) => {
      if (isAPIKeyConnection) {
        setIsConnectingManually(true);
        return;
      }

      setIsConnecting(true);

      try {
        const path = getOAuthConnectionRoute({ name: integrationName, connectionId });
        if (path) {
          window.location.assign(path);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsConnecting(false);
      }
    },
    [integrationName],
  );

  const onManualConnect = async (credential: unknown) => {
    setIsConnecting(true);

    try {
      const error = await connectIntegrationByAPIKey({
        name: integrationName,
        credential: credential as Credential,
        connectionId,
      });
      if (error) {
        toast.error(error);
      }
      toast.success(`Successfully connected ${capitalizeFirstLetter(integrationName)}`);
      router.push(`/connections/${integrationName.toLowerCase()}`);
    } catch (err) {
      toast.error('Unable to connect to the Integration');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog>
      <div className="flex w-80 bg-mastra-bg-3 h-[56px] rounded  content-center justify-between  px-4">
        <div className="flex content-center justify-center gap-4">
          <div className="flex w-7 content-center justify-center">
            <Image
              src={imageSrc}
              alt={`${integrationName} logo`}
              width={16}
              height={16}
              className="h-7 w-7 self-center"
            />
          </div>
          <span className="content-center text-lg font-bold">{capitalizeFirstLetter(integrationName)}</span>
        </div>

        <DialogTrigger asChild>
          <div className="flex items-center gap-2">
            {!link ? (
              <Button
                variant="default"
                className="h-8 self-center border-[0.1px] cursor-default border-mastra-border-1 bg-mastra-bg-4 hover:bg-mastra-bg-2/80 transition-colors  text-mastra-el-6 rounded"
                disabled={isConnectingManually}
              >
                Connect
              </Button>
            ) : (
              <>
                <Dropdown>
                  <Dropdown.Trigger asChild>
                    <Button variant={'outline'}>Manage</Button>
                  </Dropdown.Trigger>
                  <Dropdown.Content>
                    <Dropdown.Item onClick={() => handleConnect(connectionId)}>Reconnect</Dropdown.Item>
                    <Dropdown.Item onClick={() => {}}>Disconnect</Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown>

                <Button variant="default" onClick={viewRecords}>
                  View records
                </Button>
              </>
            )}
          </div>
        </DialogTrigger>

        <IntegrationConnectDialog
          connectOptions={APIKeyConnectOptions}
          isOpen={isConnectingManually}
          onCancel={() => setIsConnectingManually(false)}
          onConnect={onManualConnect}
        />
      </div>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>Add Connection</DialogTitle>
        </VisuallyHidden>
        <ReferenceDialog setConnectionId={setConnectionId} handleConnect={handleConnect} />
      </DialogContent>
    </Dialog>
  );
};
