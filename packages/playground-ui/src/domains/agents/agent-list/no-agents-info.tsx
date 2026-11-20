import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';

export const NoAgentsInfo = () => (
  <EmptyState
    titleSlot="No Agents yet"
    descriptionSlot="Configure agents in code to get started."
    actionSlot={
      <Button
        variant="ghost"
        render={<a href="https://mastra.ai/docs/agents/overview" target="_blank" rel="noopener noreferrer" />}

        icon={<IconSquareArrowTopRight />}
      >
        Agents documentation
      </Button>
    }
    variant="fill"
  />
);
