import { Txt } from '@/ds/components/Txt';
import { ScoringEntityType } from '@mastra/core';
import { useScorers } from '../hooks/use-scorers';
import { Skeleton } from '@/components/ui/skeleton';
import { useRef } from 'react';
import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName } from '@/ds/components/Entity';
import { GetScorerResponse } from '@mastra/client-js';
import { ThumbsUpIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';

export interface ScorerListProps {
  entityId: string;
  entityType: ScoringEntityType;
}

export const ScorerList = ({ entityId, entityType }: ScorerListProps) => {
  const { scorers, isLoading } = useScorers();

  if (isLoading) {
    return <ScorerSkeleton />;
  }

  const scorerList = Object.keys(scorers)
    .filter(scorerKey => {
      const scorer = scorers[scorerKey];
      if (entityType === 'AGENT') {
        return scorer.agentIds.includes(entityId);
      }

      return scorer.workflowIds.includes(entityId);
    })
    .map(scorerKey => ({ ...scorers[scorerKey], id: scorerKey }));

  console.log(entityId, scorerList);

  if (scorerList.length === 0) {
    return <EmptyScorerList />;
  }

  return (
    <ul className="space-y-2">
      {scorerList.map(scorer => (
        <li key={scorer.id}>
          <ScorerEntity scorer={scorer} />
        </li>
      ))}
    </ul>
  );
};

export const EmptyScorerList = () => {
  return (
    <Txt as="p" variant="ui-lg" className="text-icon6">
      No scorers were attached to this agent. You can create scorer following the{' '}
      <a href="https://mastra.ai/docs" target="_blank" rel="noopener noreferrer" className="underline">
        documentation
      </a>
      .
    </Txt>
  );
};

export const ScorerSkeleton = () => {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
};

interface ScorerEntityProps {
  scorer: GetScorerResponse & { id: string };
}

const ScorerEntity = ({ scorer }: ScorerEntityProps) => {
  const { Link } = useLinkComponent();
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <Entity onClick={() => linkRef.current?.click()}>
      <EntityIcon>
        <ThumbsUpIcon className="group-hover/entity:text-accent3" />
      </EntityIcon>
      <EntityContent>
        <EntityName>
          <Link ref={linkRef} href={`/scorers/${scorer.id}`}>
            {scorer.scorer.name}
          </Link>
        </EntityName>
        <EntityDescription>{scorer.scorer.description}</EntityDescription>
      </EntityContent>
    </Entity>
  );
};
