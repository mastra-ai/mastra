'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';

import { buildRedirectUri } from './actions';

type IntegrationRowProps = {
  name: string;
};

export function IntegrationRow({ name }: IntegrationRowProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      window.location.assign(await buildRedirectUri({ name, connectionId: '1', clientRedirectPath: 'import-data' }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnectingManually, name]);

  return (
    <div className="flex">
      <div className="flex-1 self-center">
        <p key={name}>{name}</p>
      </div>
      <Button className="h-[31px] text-xs" size="sm" onClick={handleConnect}>
        Connect
      </Button>
    </div>
  );
}
