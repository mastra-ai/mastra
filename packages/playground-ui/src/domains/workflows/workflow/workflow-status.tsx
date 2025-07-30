import { Txt } from '@/ds/components/Txt';
import { CheckIcon, CrossIcon, Icon } from '@/ds/icons';
import { CirclePause, HourglassIcon, Loader2 } from 'lucide-react';
import { WorkflowCard } from './workflow-card';
import { SyntaxHighlighter } from '@/components/syntax-highlighter';
import { CopyButton } from '@/components/ui/copy-button';

export interface WorkflowStatusProps {
  stepId: string;
  status: string;
  result: Record<string, unknown>;
}

export const WorkflowStatus = ({ stepId, status, result }: WorkflowStatusProps) => {
  return (
    <WorkflowCard
      header={
        <div className="flex items-center gap-3">
          <Icon>
            {status === 'success' && <CheckIcon className="text-accent1" />}
            {status === 'failed' && <CrossIcon className="text-accent2" />}
            {status === 'suspended' && <CirclePause className="text-accent3" />}
            {status === 'waiting' && <HourglassIcon className="text-accent5" />}
            {status === 'running' && <Loader2 className="text-accent6 animate-spin" />}
          </Icon>
          <Txt as="span" variant="ui-lg" className="text-icon6 font-medium">
            {stepId.charAt(0).toUpperCase() + stepId.slice(1)}
          </Txt>
        </div>
      }
    >
      <div className="rounded-md bg-surface4 p-1 font-mono relative">
        <CopyButton content={JSON.stringify(result, null, 2)} className="absolute top-2 right-2 z-10" />
        <SyntaxHighlighter data={result} />
      </div>
    </WorkflowCard>
  );
};
