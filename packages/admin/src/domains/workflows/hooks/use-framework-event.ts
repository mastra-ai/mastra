import { RefinedIntegrationEvent } from '@kepler/core';
import { useEffect, useState } from 'react';

import { getFrameworkEvent } from '../actions';
import { getParsedFrameworkEvents } from '../utils';

export const useFrameworkEvent = ({
  eventKey,
  integrationName,
  referenceId = '',
}: {
  eventKey: string;
  integrationName: string;
  referenceId: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [frameworkEvent, setFrameworkEvent] = useState<RefinedIntegrationEvent | null>(null);

  useEffect(() => {
    const getApi = async () => {
      if (!eventKey || !integrationName) {
        setFrameworkEvent(null);
        setIsLoading(false);
        return;
      }
      try {
        const serializedApi = await getFrameworkEvent({ eventKey, integrationName, referenceId });
        if (serializedApi) {
          const api = getParsedFrameworkEvents(serializedApi);
          setFrameworkEvent(api?.[0] || null);
        } else {
          setFrameworkEvent(null);
        }
        setIsLoading(false);
      } catch (err) {
        console.log(`Eror getting event for ${eventKey}=`, err);
        setFrameworkEvent(null);
        setIsLoading(false);
      }
    };

    getApi();
  }, [eventKey, integrationName, referenceId]);

  return {
    frameworkEvent,
    isLoading,
  };
};
