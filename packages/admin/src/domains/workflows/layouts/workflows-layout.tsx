'use client';

import { NextPage } from 'next';
import React from 'react';

import { useParams } from 'next/navigation';

import WorkflowHeader from '../components/workflows-header/workflow-header';
import WorkflowsHeader from '../components/workflows-header/workflows-header';

const WorkflowsLayout: NextPage<{ children: React.ReactNode }> = ({ children }) => {
  const { blueprintId } = useParams() as { blueprintId: string };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        {blueprintId ? <WorkflowHeader blueprintId={blueprintId} /> : <WorkflowsHeader />}
      </div>
      <div className="grow overflow-hidden">{children}</div>
    </div>
  );
};

export default WorkflowsLayout;
