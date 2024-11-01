'use client';

import { useCallback, useEffect, useState } from 'react';

import { getFrameworkConfigName, getConnectionIds, createSystemConnection } from '@/app/(dashboard)/actions';

export const useGetConnectionIds = ({ integrationName }: { integrationName: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionIds, setConnectionIds] = useState<{ connectionId: string }[]>([]);

  const _getConnectionIds = useCallback(async () => {
    try {
      const appname = await getFrameworkConfigName();
      const isSystem = appname === integrationName;

      const data = await getConnectionIds({ integrationName: integrationName });

      if (isSystem && !data?.length) {
        const res = await createSystemConnection();

        if (res) {
          setConnectionIds([res]);
          setIsLoading(false);
          return;
        }
      }

      setConnectionIds(data || []);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
    }
  }, [integrationName]);

  useEffect(() => {
    _getConnectionIds();
  }, [_getConnectionIds]);

  return {
    connectionIds,
    isLoading,
    refetch: _getConnectionIds,
  };
};
