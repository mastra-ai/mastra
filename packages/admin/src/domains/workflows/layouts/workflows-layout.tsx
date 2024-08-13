'use client';

import { NextPage } from 'next';
import React from 'react';

import WorkflowsHeader from '../components/workflows-header/workflows-header';

const WorkflowsLayout: NextPage<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <WorkflowsHeader />
      </div>
      <div className="grow overflow-hidden">{children}</div>
    </div>
  );
};

export default WorkflowsLayout;
