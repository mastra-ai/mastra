'use client';

import { RefinedIntegrationApi } from '@mastra/core';
import { useEffect, useState } from 'react';

import { getFrameworkApi } from '../actions';
import { getParsedFrameworkApis } from '../utils';

export const useFrameworkApi = ({
  apiType,
  integrationName,
  connectionId = '',
}: {
  apiType: string;
  integrationName: string;
  connectionId: string;
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
        const serializedApi = await getFrameworkApi({ apiType, integrationName, connectionId });
        if (serializedApi) {
          const api = getParsedFrameworkApis(serializedApi);
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
  }, [apiType, integrationName, connectionId]);

  return {
    frameworkApi,
    isLoading,
  };
};
