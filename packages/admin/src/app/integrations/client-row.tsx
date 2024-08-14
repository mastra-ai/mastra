'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';

type IntegrationRowProps = {
  name: string;
};

export function IntegrationRow({ name }: IntegrationRowProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const path = '/api/integrations/connect/connect';
      const params = new URLSearchParams({
        name,
        connectionId: '1',
        clientRedirectPath: 'import-data',
      });

      window.location.assign(`${path}?${params.toString()}`);
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
