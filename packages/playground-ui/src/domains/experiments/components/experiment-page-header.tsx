'use client';

import { format } from 'date-fns';
import { DatasetRun } from '@mastra/client-js';
import { PlayCircle, Calendar1Icon, CrosshairIcon } from 'lucide-react';
import { MainHeader } from '@/ds/components/MainHeader';
import { CopyButton } from '@/ds/components/CopyButton';
import { TextAndIcon } from '@/ds/components/Text/text-and-icon';
import { useLinkComponent } from '@/lib/framework';
import { useAgents } from '../../agents/hooks/use-agents';
import { useWorkflows } from '../../workflows/hooks/use-workflows';
import { useScorers } from '../../scores/hooks/use-scorers';
import { ExperimentStats } from './experiment-stats';

export type ExperimentPageHeaderProps = {
  runId: string;
  run: DatasetRun;
};

export function ExperimentPageHeader({ runId, run }: ExperimentPageHeaderProps) {
  const { Link, paths } = useLinkComponent();
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();

  const getTargetPath = () => {
    switch (run.targetType) {
      case 'agent':
        return paths.agentLink(run.targetId);
      case 'workflow':
        return paths.workflowLink(run.targetId);
      case 'scorer':
        return paths.scorerLink(run.targetId);
      default:
        return '#';
    }
  };

  const getTargetName = () => {
    const targetId = run.targetId;
    if (!targetId) return targetId;

    switch (run.targetType) {
      case 'agent':
        return agents?.[targetId]?.name ?? targetId;
      case 'workflow':
        return workflows?.[targetId]?.name ?? targetId;
      case 'scorer':
        return scorers?.[targetId]?.scorer?.config?.name ?? targetId;
      default:
        return targetId;
    }
  };

  return (
    <MainHeader>
      <MainHeader.Column>
        <MainHeader.Title>
          <PlayCircle />
          {runId} {runId && <CopyButton content={runId} />}
        </MainHeader.Title>
        <MainHeader.Description>
          <TextAndIcon>
            <Calendar1Icon /> Created at {format(new Date(run.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </TextAndIcon>
          {run.completedAt && (
            <TextAndIcon>
              <Calendar1Icon /> Completed at {format(new Date(run.completedAt), "MMM d, yyyy 'at' h:mm a")}
            </TextAndIcon>
          )}
        </MainHeader.Description>
        <MainHeader.Description>
          <TextAndIcon>
            <CrosshairIcon /> Target
            <Link href={getTargetPath()}>{getTargetName()}</Link>
          </TextAndIcon>
        </MainHeader.Description>
      </MainHeader.Column>
      <MainHeader.Column>
        <ExperimentStats run={run} />
      </MainHeader.Column>
    </MainHeader>
  );
}
