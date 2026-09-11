import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { CircleSlashIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react';
import { Link } from 'react-router';

export const NoWorkflowsInfo = ({ canCreate = false }: { canCreate?: boolean }) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<CircleSlashIcon />}
      titleSlot="No Workflows yet"
      descriptionSlot={
        <>
          Mastra workflows are not configured yet. <br />
          Create one with the builder, or read the documentation.
        </>
      }
      actionSlot={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {canCreate ? (
            <Button variant="primary" as={Link} to="/workflow-builder/create">
              <PlusIcon /> Create workflow
            </Button>
          ) : null}
          <Button
            variant="ghost"
            as="a"
            href="https://mastra.ai/docs/workflows/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflows Documentation <ExternalLinkIcon />
          </Button>
        </div>
      }
    />
  </div>
);
