import { useEffect, useState } from 'react';

import { getBlueprint, getBlueprints } from '../actions';
import { AutomationBlueprintWithRelations } from '../types';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<AutomationBlueprintWithRelations[]>([]);

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
  const [workflow, setWorkflow] = useState<AutomationBlueprintWithRelations>({} as AutomationBlueprintWithRelations);

  useEffect(() => {
    const getWorkfows = async () => {
      const data = await getBlueprint(blueprintId);
      setWorkflow(data as AutomationBlueprintWithRelations);
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
