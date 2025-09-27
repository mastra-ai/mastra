import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetVNextNetworkResponse } from '@mastra/client-js';
import { client } from '@/lib/client';
import { usePlaygroundStore } from '@mastra/playground-ui';

export const useVNextNetworks = () => {
  const [networks, setNetworks] = useState<GetVNextNetworkResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNetworks = async () => {
      setIsLoading(true);
      try {
        const res = await client.getVNextNetworks();
        setNetworks(res);
      } catch (error) {
        setNetworks([]);
        console.error('Error fetching networks', error);
        toast.error('Error fetching networks');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetworks();
  }, []);

  return { vNextNetworks: networks, isLoading };
};

export const useVNextNetwork = (networkId: string, enabled = true) => {
  const { runtimeContext } = usePlaygroundStore();
  const [network, setNetwork] = useState<GetVNextNetworkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNetwork = async () => {
      setIsLoading(true);
      try {
        const network = client.getVNextNetwork(networkId);
        setNetwork(await network.details(runtimeContext));
      } catch (error) {
        setNetwork(null);
        console.error('Error fetching network', error);
        toast.error('Error fetching network');
      } finally {
        setIsLoading(false);
      }
    };

    if (networkId && enabled) {
      fetchNetwork();
    }
  }, [networkId, enabled, runtimeContext]);

  return { vNextNetwork: network, isLoading };
};
