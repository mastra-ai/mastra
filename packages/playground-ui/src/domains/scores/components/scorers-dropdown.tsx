import { Dropdown } from '@/components/ui/dropdown-menu';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { ChevronDown, GaugeIcon } from 'lucide-react';

export const ScorersDropdown = () => {
  const { data: scorers = {}, isLoading } = useScorers();

  const scorerList = Object.entries(scorers).map(([key, scorer]) => ({
    id: key,
    name: scorer.scorer.config.name,
    description: scorer.scorer.config.description,
  }));

  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button variant="light">
          <Icon>
            <GaugeIcon />
          </Icon>
          Run scorer
          <Icon>
            <ChevronDown />
          </Icon>
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Content>
        {scorerList.map(scorer => (
          <Dropdown.Item key={scorer.id}>
            <span>{scorer.name}</span>
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown>
  );
};
