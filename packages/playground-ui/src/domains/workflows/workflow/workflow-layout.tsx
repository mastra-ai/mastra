import { WorkflowRunProvider } from '../context/workflow-run-context';

export const WorkflowLayout = ({ children }: { children: React.ReactNode }) => {
  return <WorkflowRunProvider>{children}</WorkflowRunProvider>;
};
