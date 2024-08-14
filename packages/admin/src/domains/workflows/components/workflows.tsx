'use client';

import React from 'react';

import { useManageWorkflow } from '../hooks/use-manage-workflow';
import { Workflow } from '../types';

import WorkflowsTable from './workflows-table';
import { workflowsColumns } from './workflows-table-columns';

export const Workflows = ({ workflows }: { workflows: Workflow[] }) => {
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
