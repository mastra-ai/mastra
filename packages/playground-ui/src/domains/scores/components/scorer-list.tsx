import { Txt } from '@/ds/components/Txt';
import { ScoringEntityType } from '@mastra/core/scores';
import { useScorers } from '../hooks/use-scorers';
import { Skeleton } from '@/components/ui/skeleton';
import { useRef } from 'react';
import { Entity, EntityContent, EntityDescription, EntityIcon, EntityName } from '@/ds/components/Entity';
import { GetScorerResponse } from '@mastra/client-js';
import { GaugeIcon } from 'lucide-react';
import { useLinkComponent } from '@/lib/framework';
import { Badge } from '@/ds/components/Badge';

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
  // TODO: Add a link to the scorer documentation when available
  return (
    <Txt as="p" variant="ui-lg" className="text-icon6">
      No scorers were attached to this agent.
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
        <GaugeIcon className="group-hover/entity:text-accent3" />
      </EntityIcon>
      <EntityContent>
        <EntityName>
          <Link ref={linkRef} href={`/scorers/${scorer.id}`}>
            {scorer.scorer.config.name}
          </Link>
        </EntityName>
        <EntityDescription>{scorer.scorer.config.description}</EntityDescription>

        {scorer.sampling?.type === 'ratio' && (
          <Badge>
            <span className="text-icon3">Sample rate:</span>
            <span className="text-icon6">{scorer.sampling.rate}</span>
          </Badge>
        )}
      </EntityContent>
    </Entity>
  );
};
