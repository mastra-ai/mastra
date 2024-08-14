'use client';

import React from 'react';

import { useManageWorkflow } from '../hooks/use-manage-workflow';
import { AutomationBlueprintWithRelations } from '../types';

import WorkflowsTable from './workflows-table/workflows-table';
import { workflowsColumns } from './workflows-table/workflows-table-columns';

export const Workflows = ({ workflows }: { workflows: AutomationBlueprintWithRelations[] }) => {
  const { handleOpenWorkflow, handleRunWorkflow, handleDeleteWorkflow } = useManageWorkflow();

  return (
    <WorkflowsTable
      data={workflows}
      columns={workflowsColumns({
        handleOpenWorkflow,
        handleRunWorkflow,
        handleDeleteWorkflow,
      })}
    />
  );
};
