'use client';

import { APIKey, IntegrationCredentialType } from 'core';
import React, { useCallback, useState } from 'react';
import { JsonSchema7Type } from 'zod-to-json-schema';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { capitalizeFirstLetter } from '@/lib/string';

import { connectIntegration } from '@/app/plugins/actions';

import { ConnectDialog } from './plugin-connect-dialog';

interface PluginListRowProps {
  pluginName: string;
  imageSrc: string;
  authType: IntegrationCredentialType;
  authConnectionOptions?: JsonSchema7Type;
}

export const PluginListRow = ({ pluginName, imageSrc, authType, authConnectionOptions }: PluginListRowProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const link = null;
  const viewRecords = () => {};

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);

    if (authType === IntegrationCredentialType.API_KEY) {
      return;
    }

    try {
      const path = '/api/integrations/connect';
      const params = new URLSearchParams({
        name: pluginName,
        connectionId: '1',
        clientRedirectPath: `/records/${pluginName.toLowerCase()}`,
      });

      window.location.assign(`${path}?${params.toString()}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  }, [pluginName]);

  const onConnect = async (credentials: unknown) => {
    try {
      await connectIntegration({
        name: pluginName,
        connectionId: '1', // TODO: Connection ID should change
        credentialValue: credentials as APIKey,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex h-[56px] w-auto content-center justify-between border px-4">
      <div className="flex content-center justify-center gap-4">
        <div className="flex w-7 content-center justify-center">
          <Image
            src={`/plugins/${imageSrc}`}
            alt={`${pluginName} logo`}
            width={16}
            height={16}
            className="h-7 w-7 self-center"
          />
        </div>
        <span className="content-center text-lg font-bold">{capitalizeFirstLetter(pluginName)}</span>
      </div>

      <div className="flex items-center gap-2">
        {!link ? (
          <Button variant="default" className="h-8 self-center rounded-md" onClick={handleConnect}>
            Connect
          </Button>
        ) : (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={'outline'}>Manage</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleConnect}>Reconnect</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {}}>Disconnect</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="default" onClick={viewRecords}>
              View records
            </Button>
          </>
        )}
      </div>
      <ConnectDialog
        isOpen={authType === IntegrationCredentialType.API_KEY && isConnecting}
        connectOptions={authConnectionOptions!}
        onConnect={onConnect}
        onCancel={() => setIsConnecting(false)}
      />
    </div>
  );
};
