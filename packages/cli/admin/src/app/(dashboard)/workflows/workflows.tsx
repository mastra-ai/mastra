'use client';

import type { BlueprintWithRelations } from '@mastra/core/dist/workflows/types';
import React from 'react';

import { DeleteWorkflowDialog } from '@/domains/workflows/components/dialogs/delete-workflow-dialog';
import WorkflowsTable from '@/domains/workflows/components/workflows-table/workflows-table';
import { workflowsColumns } from '@/domains/workflows/components/workflows-table/workflows-table-columns';
import { useManageWorkflow } from '@/domains/workflows/hooks/use-manage-workflow';
import { useGetWorkflows } from '@/domains/workflows/hooks/use-workflow';

export const Workflows = () => {
  const { workflows, isLoading, refetch } = useGetWorkflows();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleOpenWorkflow, handleRunWorkflow, handleDeleteWorkflow } =
    useManageWorkflow();

  const loadingData = { id: 'loading', isLoading: true } as BlueprintWithRelations;

  const loadingArr = [loadingData, loadingData, loadingData, loadingData];

  return (
    <div className="h-full overflow-scroll scroll-smooth">
      <WorkflowsTable
        data={isLoading ? loadingArr : workflows || []}
        columns={workflowsColumns({
          handleOpenWorkflow,
          handleRunWorkflow,
          handleDeleteWorkflow,
        })}
      />
      <DeleteWorkflowDialog
        isOpen={!!deleteWorkflowId}
        blueprintId={deleteWorkflowId!}
        setOpen={handleCloseDeleteWorkflow}
        onDelete={refetch}
      />
    </div>
  );
};
