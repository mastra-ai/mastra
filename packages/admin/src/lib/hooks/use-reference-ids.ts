import { useCallback, useEffect, useState } from 'react';

import { getFrameworkConfigName, getConnectionIds } from '@/app/(dashboard)/actions';

export const useGetConnectionIds = ({ integrationName }: { integrationName: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [connectionIds, setConnectionIds] = useState<{ connectionId: string }[]>([]);

  const _getConnectionIds = useCallback(async (intName: string) => {
    try {
      const appname = await getFrameworkConfigName();
      const _intName = appname === intName ? '' : intName;
      const data = await getConnectionIds({ integrationName: _intName });
      setConnectionIds(data || []);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    _getConnectionIds(integrationName);
  }, [_getConnectionIds, integrationName]);

  return {
    connectionIds,
    isLoading,
    refetch: _getConnectionIds,
  };
};
