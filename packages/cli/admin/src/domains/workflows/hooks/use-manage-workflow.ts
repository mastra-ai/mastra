'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { useCreateWorkflow } from './use-workflow';

export const useManageWorkflow = () => {
  const router = useRouter();

  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | undefined>();

  const { createBlueprint } = useCreateWorkflow();

  const handleOpenWorkflow = (workflowId: string) => {
    router.push(`/workflows/${workflowId}`);
  };

  const handleCreateWorkflow = () => {
    createBlueprint();
  };

  const handleRunWorkflow = async (workflowId: string) => {
    // await runBlueprint({ blueprintId: workflowId });
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    setDeleteWorkflowId(workflowId);
  };

  const handleCloseDeleteWorkflow = () => {
    setDeleteWorkflowId(undefined);
  };

  return {
    handleOpenWorkflow,
    handleRunWorkflow,
    handleCreateWorkflow,
    handleDeleteWorkflow,
    deleteWorkflowId,
    handleCloseDeleteWorkflow,
  };
};
