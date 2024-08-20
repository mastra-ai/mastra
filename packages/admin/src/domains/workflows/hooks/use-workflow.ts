import { BlueprintWithRelations, UpdateBlueprintDto } from '@arkw/core';
import { useEffect, useState } from 'react';

import { toast } from '@/lib/toast';

import { getBlueprint, getBlueprints, saveBlueprint } from '../actions';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<BlueprintWithRelations[]>([]);

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

  useEffect(() => {
    getWorkfows();
  }, []);

  return {
    workflows,
    isLoading,
    refetch: getWorkfows,
  };
};

export const useGetWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(!!blueprintId);
  const [workflow, setWorkflow] = useState<BlueprintWithRelations>({} as BlueprintWithRelations);

  const getWorkfow = async () => {
    try {
      const data = await getBlueprint(blueprintId);
      setWorkflow(data as BlueprintWithRelations);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  };

  useEffect(() => {
    if (blueprintId) {
      getWorkfow();
    }
  }, [blueprintId]);

  return {
    workflow,
    isLoading,
    refetch: getWorkfow,
  };
};

export const useUpdateWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateBlueprint = async (blueprint: UpdateBlueprintDto) => {
    setIsLoading(true);
    try {
      await saveBlueprint(blueprintId, blueprint);
      setIsLoading(false);
      setSuccess(true);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  };

  return {
    updateBlueprint,
    isLoading,
    success,
  };
};
