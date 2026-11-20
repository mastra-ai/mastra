import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';

export const NoWorkflowsInfo = () => (
  <EmptyState
    titleSlot="No Workflows yet"
    descriptionSlot={
      <>
        Mastra workflows are not configured yet. <br />
        More information in the documentation.
      </>
    }
    actionSlot={
      <Button
        variant="ghost"
        render={<a href="https://mastra.ai/docs/workflows/overview" target="_blank" rel="noopener noreferrer" />}

        icon={<IconSquareArrowTopRight />}
      >
        Workflows documentation
      </Button>
    }
    variant="fill"
  />
);
