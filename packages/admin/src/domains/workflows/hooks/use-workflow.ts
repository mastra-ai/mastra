import { BlueprintWithRelations, UpdateBlueprintDto, WorkflowStatusEnum } from '@arkw/core';
import { createId } from '@paralleldrive/cuid2';
import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import useLocalStorage from '@/lib/hooks/use-local-storage';
import { toast } from '@/lib/toast';

import { getBlueprint, getBlueprints, saveBlueprint } from '../actions';

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<BlueprintWithRelations[]>([]);
  const [localBlueprints] = useLocalStorage<Record<string, BlueprintWithRelations>>('blueprints', {});

  const getWorkfows = useCallback(async () => {
    try {
      const data = await getBlueprints();
      const newWorkflows = data?.map(wflow => {
        const currentLocalBlueprint = localBlueprints[wflow.id] || {};
        const newFklw = { ...wflow, ...currentLocalBlueprint };
        return newFklw;
      });
      setWorkflows(newWorkflows);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  }, [localBlueprints]);

  useEffect(() => {
    getWorkfows();
  }, [getWorkfows]);

  return {
    workflows,
    isLoading,
    refetch: getWorkfows,
  };
};

export const useGetWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(!!blueprintId);
  const [workflow, setWorkflow] = useState<BlueprintWithRelations>({} as BlueprintWithRelations);
  const [localBlueprints, setLocalBlueprints] = useLocalStorage<Record<string, BlueprintWithRelations>>(
    'blueprints',
    {},
  );

  const currentLocalBlueprint = localBlueprints[blueprintId];

  const getWorkfow = async () => {
    try {
      const data = await getBlueprint(blueprintId);
      setWorkflow(data);
      if (!currentLocalBlueprint) {
        setLocalBlueprints({
          ...localBlueprints,
          [blueprintId]: data,
        });
      }
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
    localBlueprint: currentLocalBlueprint || workflow,
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

export const useCreateWorkflow = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const createBlueprint = async () => {
    setIsLoading(true);
    try {
      const blueprintId = createId();
      const blueprint = {
        title: 'New workflow',
        trigger: { id: '', type: '' },
        actions: [],
        status: WorkflowStatusEnum.DRAFT,
        createdAt: new Date(),
      };
      await saveBlueprint(blueprintId, blueprint);
      toast.success('Workflow created');
      router.push(`/workflows/${blueprintId}`);
      setIsLoading(false);
      setSuccess(true);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  };

  return {
    createBlueprint,
    isLoading,
    success,
  };
};
