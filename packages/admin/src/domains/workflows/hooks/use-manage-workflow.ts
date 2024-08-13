import { useState } from 'react';

import { useRouter } from 'next/navigation';

export const useManageWorkflow = () => {
  const router = useRouter();

  const [deleteWorkflowId, setDeleteWorkflowId] = useState<string | undefined>();

  const handleOpenWorkflow = (workflowId: string) => {
    router.push(`/workflows/${workflowId}`);
  };

  const handleCreateWorkflow = () => {
    // TODO: most likely read to js file
    // createWorkflow(
    //   {
    //     title: 'New Workflow',
    //     status: AutomationStatus.DRAFT,
    //     trigger: null,
    //     actions: [],
    //   },
    //   {
    //     onSuccess: (data: AutomationBlueprint) => {
    //       toast.success('Workflow created');
    //       router.push(`/workflows/${data.id}`);
    //     },
    //   },
    // );
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
