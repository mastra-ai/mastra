import { createContext, useContext } from 'react';
import { WorkflowStatusType } from './types';

const WorkflowStatusContext = createContext<WorkflowStatusType>('waiting');

export const WorkflowStatusProvider = WorkflowStatusContext.Provider;

export const useWorkflowStatus = () => {
  return useContext(WorkflowStatusContext);
};
