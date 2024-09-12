import { RefinedIntegrationApi } from '@kepler/core';
import { useEffect, useState } from 'react';

import { getFrameworkApi } from '../actions';
import { getParsedFrameworkActions } from '../utils';

export const useFrameworkApi = ({
  apiType,
  integrationName,
  referenceId = '',
}: {
  apiType: string;
  integrationName: string;
  referenceId: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [frameworkApi, setFrameworkApi] = useState<RefinedIntegrationApi | null>(null);

  useEffect(() => {
    const getApi = async () => {
      if (!apiType || !integrationName) {
        setFrameworkApi(null);
        setIsLoading(false);
        return;
      }
      try {
        const serializedApi = await getFrameworkApi({ apiType, integrationName, referenceId });
        if (serializedApi) {
          const api = getParsedFrameworkActions(serializedApi);
          setFrameworkApi(api?.[0] || null);
        } else {
          setFrameworkApi(null);
        }
        setIsLoading(false);
      } catch (err) {
        console.log(`Eror getting api for ${apiType}=`, err);
        setFrameworkApi(null);
        setIsLoading(false);
      }
    };

    getApi();
  }, [apiType, integrationName, referenceId]);

  return {
    frameworkApi,
    isLoading,
  };
};
