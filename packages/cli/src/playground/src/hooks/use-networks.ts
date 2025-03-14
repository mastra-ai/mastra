import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetNetworkResponse, MastraClient } from '@mastra/client-js';

export const useNetworks = () => {
  const [networks, setNetworks] = useState<Record<string, GetNetworkResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  const client = new MastraClient({
    baseUrl: '',
  });

  useEffect(() => {
    const fetchNetworks = async () => {
      setIsLoading(true);
      try {
        const res = await client.getNetworks();
        setNetworks(res);
      } catch (error) {
        setNetworks({});
        console.error('Error fetching networks', error);
        toast.error('Error fetching networks');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetworks();
  }, []);

  return { networks, isLoading };
};

export const useNetwork = (networkId: string) => {
  const [network, setNetwork] = useState<GetNetworkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new MastraClient({
    baseUrl: '',
  });

  useEffect(() => {
    const fetchNetwork = async () => {
      setIsLoading(true);
      try {
        if (!networkId) {
          setNetwork(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getNetwork(networkId).details();

        console.log(await client.getNetwork(networkId));

        setNetwork(res);
      } catch (error) {
        setNetwork(null);
        console.error('Error fetching network', error);
        toast.error('Error fetching network');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNetwork();
  }, [networkId]);

  return { network, isLoading };
};
