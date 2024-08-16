'use client';

import React, { useCallback, useState } from 'react';

import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { capitalizeFirstLetter } from '@/lib/string';

interface PluginListRowProps {
  pluginName: string;
  imageSrc: string;
}

export const PluginListRow = ({ pluginName, imageSrc }: PluginListRowProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);
  const link = null;

  const viewRecords = () => {};

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
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
  }, [isConnectingManually, pluginName]);
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
    </div>
  );
};
