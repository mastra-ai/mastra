import { Dropdown } from '@/components/ui/dropdown-menu';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { ChevronDown, GaugeIcon } from 'lucide-react';
import { useTriggerScorer } from '../hooks/use-trigger-scorer';
import Spinner from '@/components/ui/spinner';
import { AISpanRecord } from '@mastra/core';

export interface ScorersDropdownProps {
  trace: AISpanRecord;
  spanId?: string;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
  entityType?: string;
}

export const ScorersDropdown = ({ trace, spanId, onScorerTriggered, entityType }: ScorersDropdownProps) => {
  const { data: scorers = {}, isLoading } = useScorers();
  const { mutate: triggerScorer, isPending } = useTriggerScorer(onScorerTriggered);

  let scorerList = Object.entries(scorers).map(([key, scorer]) => ({
    id: key,
    name: scorer.scorer.config.name,
    description: scorer.scorer.config.description,
    isRegistered: scorer.isRegistered,
    type: scorer.scorer.config.type,
  }));

  // Filter out Scorers with type agent if we are not scoring on a top level agent generated span
  if (entityType !== 'Agent' || spanId) {
    scorerList = scorerList.filter(scorer => scorer.type !== 'agent');
  }

  const isWaiting = isPending || isLoading;

  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button variant="light" disabled={isWaiting}>
          {isWaiting ? (
            <Icon>
              <Spinner />
            </Icon>
          ) : (
            <Icon>
              <GaugeIcon />
            </Icon>
          )}
          Run scorer
          <Icon>
            <ChevronDown />
          </Icon>
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Content>
        {scorerList
          .filter(scorer => scorer.isRegistered)
          .map(scorer => (
            <Dropdown.Item
              key={scorer.id}
              onClick={() => triggerScorer({ scorerName: scorer.name, traceId: trace.traceId, spanId })}
            >
              <span>{scorer.name}</span>
            </Dropdown.Item>
          ))}
      </Dropdown.Content>
    </Dropdown>
  );
};
