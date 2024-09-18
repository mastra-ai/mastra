import { useEffect, useState } from 'react';

import { getIntegrationConnections } from '@/app/(dashboard)/integrations/actions';

export const useConnections = ({ name }: { name: string }) => {
  const [connections, setConnections] = useState<
    {
      id: string;
      name: string;
      referenceId: string;
      createdAt: Date;
      updatedAt: Date | null;
      lastSyncAt: Date | null;
    }[]
  >();

  useEffect(() => {
    const getConnections = async () => {
      if (!name) return;
      try {
        const intConnections = await getIntegrationConnections({ name });
        setConnections(intConnections);
      } catch (err) {
        console.log(`Error getting connections for ${name}=`, { err });
      }
    };

    getConnections();
  }, [name]);

  return { connections };
};
