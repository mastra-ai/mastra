import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Plus, CircleSlashIcon, BookOpen } from 'lucide-react';

export interface EmptyDatasetsTableProps {
  onCreateClick?: () => void;
}

export function EmptyDatasetsTable({ onCreateClick }: EmptyDatasetsTableProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<CircleSlashIcon className="text-neutral3 size-10" />}
        titleSlot="No Datasets Yet"
        descriptionSlot="Create your first dataset to start evaluating your agents and workflows."
        actionSlot={
          <div className="flex flex-col gap-2 sm:flex-row">
            {onCreateClick && (
              <Button size="lg" variant="default" onClick={onCreateClick} icon={<Plus />}>
                Create Dataset
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              as="a"
              href="https://mastra.ai/docs/evals/datasets"
              target="_blank"
              rel="noopener noreferrer"
              icon={<BookOpen />}
            >
              Documentation
            </Button>
          </div>
        }
      />
    </div>
  );
}
