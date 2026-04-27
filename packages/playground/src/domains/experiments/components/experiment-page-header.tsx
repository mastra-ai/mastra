'use client';

import type { DatasetExperiment } from '@mastra/client-js';
import { CopyButton, MainHeader, TextAndIcon } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { PlayCircle, Calendar1Icon, CrosshairIcon, GitBranch } from 'lucide-react';
import { useAgents } from '../../agents/hooks/use-agents';
import { useScorers } from '../../scores/hooks/use-scorers';
import { useWorkflows } from '../../workflows/hooks/use-workflows';
import { ExperimentStats } from './experiment-stats';
import { useLinkComponent } from '@/lib/framework';

export type ExperimentPageHeaderProps = {
  experimentId: string;
  experiment: DatasetExperiment;
};

export function ExperimentPageHeader({ experimentId, experiment }: ExperimentPageHeaderProps) {
  const { Link, paths } = useLinkComponent();
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();

  const getTargetPath = () => {
    switch (experiment.targetType) {
      case 'agent':
        return paths.agentLink(experiment.targetId);
      case 'workflow':
        return paths.workflowLink(experiment.targetId);
      case 'scorer':
        return paths.scorerLink(experiment.targetId);
      default:
        return '#';
    }
  };

  const getTargetName = () => {
    const targetId = experiment.targetId;
    if (!targetId) return targetId;

    switch (experiment.targetType) {
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
          {experimentId} {experimentId && <CopyButton content={experimentId} />}
        </MainHeader.Title>
        <MainHeader.Description>
          <TextAndIcon>
            <Calendar1Icon /> Created at {format(new Date(experiment.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </TextAndIcon>
          {experiment.completedAt && (
            <TextAndIcon>
              <Calendar1Icon /> Completed at {format(new Date(experiment.completedAt), "MMM d, yyyy 'at' h:mm a")}
            </TextAndIcon>
          )}
        </MainHeader.Description>
        <MainHeader.Description>
          <TextAndIcon>
            <CrosshairIcon /> Target
            <Link href={getTargetPath()}>{getTargetName()}</Link>
          </TextAndIcon>
          {experiment.agentVersion && (
            <TextAndIcon>
              <GitBranch /> Version
              {experiment.targetType === 'agent' && experiment.targetId ? (
                <Link
                  href={`${paths.agentLink(experiment.targetId)}/editor?version=${encodeURIComponent(experiment.agentVersion)}`}
                  className="font-mono text-xs underline hover:text-accent1"
                >
                  {experiment.agentVersion}
                </Link>
              ) : (
                <span className="font-mono text-xs">{experiment.agentVersion}</span>
              )}
              <CopyButton content={experiment.agentVersion} />
            </TextAndIcon>
          )}
        </MainHeader.Description>
      </MainHeader.Column>
      <MainHeader.Column>
        <ExperimentStats experiment={experiment} />
      </MainHeader.Column>
    </MainHeader>
  );
}
