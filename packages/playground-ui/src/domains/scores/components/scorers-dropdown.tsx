import { Dropdown } from '@/components/ui/dropdown-menu';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { ChevronDown, GaugeIcon } from 'lucide-react';
import { useTriggerScorer } from '../hooks/use-trigger-scorer';
import Spinner from '@/components/ui/spinner';

export interface ScorersDropdownProps {
  traceId: string;
  spanId?: string;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
}

export const ScorersDropdown = ({ traceId, spanId, onScorerTriggered }: ScorersDropdownProps) => {
  const { data: scorers = {}, isLoading } = useScorers();
  const { mutate: triggerScorer, isPending } = useTriggerScorer(onScorerTriggered);

  const scorerList = Object.entries(scorers).map(([key, scorer]) => ({
    id: key,
    name: scorer.scorer.config.name,
    description: scorer.scorer.config.description,
    isRegistered: scorer.isRegistered,
  }));

  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button variant="light" disabled={isPending || isLoading}>
          {isPending || isLoading ? (
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
            <Dropdown.Item key={scorer.id} onClick={() => triggerScorer({ scorerName: scorer.name, traceId, spanId })}>
              <span>{scorer.name}</span>
            </Dropdown.Item>
          ))}
      </Dropdown.Content>
    </Dropdown>
  );
};
