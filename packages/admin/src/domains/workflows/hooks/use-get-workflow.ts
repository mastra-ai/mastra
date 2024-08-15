import { useEffect, useState } from 'react';

import { getConfig } from '@/lib/get-configuration';

import { AutomationBlueprintWithRelations } from '../types';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<AutomationBlueprintWithRelations[]>([]);

  useEffect(() => {
    const getWorkfows = async () => {
      const data = await getConfig().then(res => res.workflows);
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
      const data = await getConfig().then(res => res.workflows);
      const wflow = data?.find(wfl => wfl.id === blueprintId);
      setWorkflow(wflow as AutomationBlueprintWithRelations);
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
