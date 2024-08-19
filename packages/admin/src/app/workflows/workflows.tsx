'use client';

import type { BlueprintWithRelations } from 'core';
import React from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { DeleteWorkflowDialog } from '@/domains/workflows/components/dialogs/delete-workflow-dialog';
import WorkflowsTable from '@/domains/workflows/components/workflows-table/workflows-table';
import { workflowsColumns } from '@/domains/workflows/components/workflows-table/workflows-table-columns';
import { useGetWorkflows } from '@/domains/workflows/hooks/use-get-workflow';
import { useManageWorkflow } from '@/domains/workflows/hooks/use-manage-workflow';

export const Workflows = () => {
  const { workflows, isLoading } = useGetWorkflows();
  const { deleteWorkflowId, handleCloseDeleteWorkflow, handleOpenWorkflow, handleRunWorkflow, handleDeleteWorkflow } =
    useManageWorkflow();

  const loadingData = { id: 'loading', isLoading: true } as BlueprintWithRelations;

  const loadingArr = [loadingData, loadingData, loadingData, loadingData];

  return (
    <ScrollArea className="h-full" viewportClassName="kepler-workflows-scroll-area">
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
      />
    </ScrollArea>
  );
};
