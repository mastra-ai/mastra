import { Workflow as WorkflowIcon } from 'lucide-react';

export interface NestedWorkflowTriggerProps {
  onClick: () => void;
}

export const NestedWorkflowTriggerClass =
  'mastra:px-2 mastra:py-1 mastra:text-xs mastra:font-medium mastra:bg-surface4 mastra:text-text3 mastra:rounded mastra:border mastra:border-border1 mastra:hover:bg-surface5 mastra:hover:text-text6 mastra:transition-colors mastra:flex mastra:items-center mastra:gap-1';

export const NestedWorkflowTrigger = ({ onClick }: NestedWorkflowTriggerProps) => {
  return (
    <button type="button" className={NestedWorkflowTriggerClass} onClick={onClick}>
      <WorkflowIcon className="mastra:w-3 mastra:h-3" />
      <span>View workflow</span>
    </button>
  );
};
