'use client';

import { Credential } from '@kepler/core';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { capitalizeFirstLetter } from '@/lib/string';

import { connectIntegrationByAPIKey } from '@/app/(dashboard)/integrations/actions';

import { IntegrationConnectDialog } from './integration-connect-dialog';
import { ReferenceDialog } from './reference-dialog';

interface IntegrationListRowProps {
  integrationName: string;
  imageSrc: string;
  getOAuthConnectionRoute: ({
    name,
    referenceId,
  }: {
    name: string;
    referenceId: string;
  }) => Promise<string | undefined>;
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
  const [referenceId, setReferenceId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);

  const link = null;
  const viewRecords = () => {};

  const handleConnect = useCallback(
    async (referenceId: string) => {
      if (isAPIKeyConnection) {
        setIsConnectingManually(true);
        return;
      }

      setIsConnecting(true);

      try {
        const path = await getOAuthConnectionRoute({ name: integrationName, referenceId });
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
    setIsConnectingManually(false);
    setIsConnecting(true);

    try {
      const error = await connectIntegrationByAPIKey({
        name: integrationName,
        credential: credential as Credential,
        referenceId,
      });
      if (error) {
        toast.error(error);
      }
    } catch (err) {
      toast.error('Unable to connect to the Integration');
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog>
      <div className="flex w-80 bg-kp-bg-3 h-[56px] rounded  content-center justify-between  px-4">
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
                className="h-8 self-center border-[0.1px] cursor-default border-kp-border-1 bg-kp-bg-4 hover:bg-kp-bg-2/80 transition-colors  text-kp-el-6 rounded"
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
                    <Dropdown.Item onClick={() => handleConnect(referenceId)}>Reconnect</Dropdown.Item>
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
        <ReferenceDialog setReferenceId={setReferenceId} handleConnect={handleConnect} />
      </DialogContent>
    </Dialog>
  );
};
