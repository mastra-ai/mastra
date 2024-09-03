import { useCallback, useEffect, useState } from 'react';

import { getFrameworkConfigName, getReferenceIds } from '@/app/(dashboard)/actions';

export const useGetReferenceIds = ({ integrationName }: { integrationName: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [referenceIds, setReferenceIds] = useState<{ referenceId: string }[]>([]);

  const _getReferenceIds = useCallback(async (intName: string) => {
    try {
      const appname = await getFrameworkConfigName();
      const _intName = appname === intName ? '' : intName;
      const data = await getReferenceIds({ integrationName: _intName });
      setReferenceIds(data || []);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    _getReferenceIds(integrationName);
  }, [_getReferenceIds, integrationName]);

  return {
    referenceIds,
    isLoading,
    refetch: _getReferenceIds,
  };
};
