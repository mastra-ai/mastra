'use client';

import { NextPage } from 'next';
import React from 'react';

import { useParams } from 'next/navigation';

import WorkflowHeader from '../components/workflows-header/workflow-header';
import WorkflowsHeader from '../components/workflows-header/workflows-header';
import { useGetWorkflow } from '../hooks/use-get-workflow';

const WorkflowsLayout: NextPage<{ children: React.ReactNode }> = ({ children }) => {
  const { blueprintId } = useParams() as { blueprintId: string };

  const { workflow } = useGetWorkflow({ blueprintId });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">{blueprintId ? <WorkflowHeader workflow={workflow} /> : <WorkflowsHeader />}</div>
      <div className="grow overflow-hidden">{children}</div>
    </div>
  );
};

export default WorkflowsLayout;
