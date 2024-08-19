import { BlueprintWithRelations } from '@arkw/core';
import { useEffect, useState } from 'react';

import { getBlueprint, getBlueprints } from '../actions';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<BlueprintWithRelations[]>([]);

  useEffect(() => {
    const getWorkfows = async () => {
      const data = await getBlueprints();
      setWorkflows(data);
      setIsLoading(false);
    };

    getWorkfows();
  }, []);

  return {
    workflows,
    isLoading,
  };
};

export const useGetWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(!!blueprintId);
  const [workflow, setWorkflow] = useState<BlueprintWithRelations>({} as BlueprintWithRelations);

  useEffect(() => {
    const getWorkfows = async () => {
      const data = await getBlueprint(blueprintId);
      setWorkflow(data as BlueprintWithRelations);
      setIsLoading(false);
    };

    if (blueprintId) {
      getWorkfows();
    }
  }, [blueprintId]);

  return {
    workflow,
    isLoading,
  };
};
