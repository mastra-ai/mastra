import { useState, useEffect } from 'react';
import { useWebSocket } from '../use-websocket';
import type { DeploymentStatusEvent } from '@/lib/websocket-client';

export function useDeploymentStatusWs(deploymentId: string | undefined) {
  const [status, setStatus] = useState<DeploymentStatusEvent['payload'] | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!deploymentId) return;

    const unsubscribe = subscribe(`deployment:${deploymentId}`, event => {
      if (event.type === 'deployment:status') {
        setStatus(event.payload as DeploymentStatusEvent['payload']);
      }
    });

    return unsubscribe;
  }, [deploymentId, subscribe]);

  return status;
}
