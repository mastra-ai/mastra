import { BlueprintWithRelations, UpdateBlueprintDto } from '@arkw/core';
import { useEffect, useState } from 'react';

import { toast } from '@/lib/toast';

import { getBlueprint, getBlueprints, saveBlueprint } from '../actions';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<BlueprintWithRelations[]>([]);

  useEffect(() => {
    const getWorkfows = async () => {
      try {
        const data = await getBlueprints();
        setWorkflows(data);
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        toast((err as { message: string })?.message);
      }
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
      try {
        const data = await getBlueprint(blueprintId);
        setWorkflow(data as BlueprintWithRelations);
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        toast((err as { message: string })?.message);
      }
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

export const useUpdateWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(!!blueprintId);

  const updateBlueprint = async (blueprint: UpdateBlueprintDto) => {
    setIsLoading(true);
    try {
      await saveBlueprint(blueprintId, blueprint);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  };

  return {
    updateBlueprint,
    isLoading,
  };
};
