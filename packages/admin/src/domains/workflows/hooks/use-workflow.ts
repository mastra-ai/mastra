'use client';

import type { BlueprintWithRelations, UpdateBlueprintDto } from '@mastra/core/dist/workflows/types';
import { createId } from '@paralleldrive/cuid2';
import { compareDesc } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@/lib/toast';

import { getBlueprint, getBlueprints, saveBlueprint, deleteBlueprint as removeBlueprint } from '../actions';
import { WorkflowStatusEnum } from '../types';

type LocalBlueprints = Record<string, BlueprintWithRelations>;

export const useGetWorkflows = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<BlueprintWithRelations[]>([]);

  const getWorkfows = useCallback(async () => {
    try {
      const blueprints = window.localStorage.getItem('blueprints');
      const localBprints = (blueprints ? JSON.parse(blueprints) : {}) as LocalBlueprints;
      const data = await getBlueprints();
      const newWorkflows = data
        ?.map(wflow => {
          const currentLocalBlueprint = localBprints[wflow.id] || {};
          const newFklw = { ...wflow, ...currentLocalBlueprint };
          return newFklw;
        })
        ?.sort((a, b) => compareDesc(new Date(a.createdAt), new Date(b.createdAt)));
      setWorkflows(newWorkflows);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  }, []);

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
  const [localBlueprints, setLocalBlueprints] = useState<BlueprintWithRelations>({} as BlueprintWithRelations);

  const getWorkfow = async () => {
    try {
      const blueprints = window.localStorage.getItem('blueprints');
      const parsedBprints = (blueprints ? JSON.parse(blueprints) : {}) as LocalBlueprints;
      const localBprints = parsedBprints[blueprintId];
      setLocalBlueprints(localBprints);
      const data = await getBlueprint(blueprintId);
      setWorkflow(data);
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
    localBlueprint: localBlueprints || workflow,
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

export const useDeleteWorkflow = ({ blueprintId }: { blueprintId: string }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const deleteBlueprint = async () => {
    setIsLoading(true);
    try {
      await removeBlueprint(blueprintId);
      setIsLoading(false);
      setSuccess(true);
    } catch (err) {
      setIsLoading(false);
      toast((err as { message: string })?.message);
    }
  };

  return {
    deleteBlueprint,
    isLoading,
    success,
  };
};
