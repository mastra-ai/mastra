import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetNetworkResponse, MastraClient } from '@mastra/client-js';

export const useNetworks = () => {
  const [networks, setNetworks] = useState<GetNetworkResponse[]>([]);
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
        setNetworks([]);
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
        const network = client.getNetwork(networkId);
        setNetwork(await network.details());
      } catch (error) {
        setNetwork(null);
        console.error('Error fetching network', error);
        toast.error('Error fetching network');
      } finally {
        setIsLoading(false);
      }
    };

    if (networkId) {
      fetchNetwork();
    }
  }, [networkId]);

  return { network, isLoading };
};
