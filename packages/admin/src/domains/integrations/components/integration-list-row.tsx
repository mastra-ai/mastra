'use client';

import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown-menu';

import { capitalizeFirstLetter } from '@/lib/string';

// import { IntegrationConnectDialog } from './integration-connect-dialog';

interface IntegrationListRowProps {
  integrationName: string;
  imageSrc: string;
  OAuthConnectionRoute: string;
  isAPIKeyConnection?: boolean;
  APIKeyConnectOptions?: any;
}

export const IntegrationListRow = ({
  integrationName,
  imageSrc,
  OAuthConnectionRoute,
  isAPIKeyConnection,
  APIKeyConnectOptions,
}: IntegrationListRowProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);

  const link = null;
  const viewRecords = () => {};

  const handleConnect = useCallback(async () => {
    if (isAPIKeyConnection) {
      setIsConnectingManually(true);
      toast.info('API key connnections are currently  unnavailable');
      return;
    }

    setIsConnecting(true);

    try {
      const path = OAuthConnectionRoute || '';

      window.location.assign(path);
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  }, [integrationName]);

  return (
    <div className="flex h-[56px] w-auto content-center justify-between border px-4">
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

      <div className="flex items-center gap-2">
        {!link ? (
          <Button
            variant="default"
            className="h-8 self-center rounded-md"
            onClick={handleConnect}
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
                <Dropdown.Item onClick={handleConnect}>Reconnect</Dropdown.Item>
                <Dropdown.Item onClick={() => {}}>Disconnect</Dropdown.Item>
              </Dropdown.Content>
            </Dropdown>

            <Button variant="default" onClick={viewRecords}>
              View records
            </Button>
          </>
        )}
      </div>
      {/* <IntegrationConnectDialog
        connectOptions={APIKeyConnectOptions}
        isOpen={isConnectingManually}
        onCancel={() => setIsConnectingManually(false)}
        onConnect={() => {}}
      /> */}
    </div>
  );
};
