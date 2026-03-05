import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Icon } from '@/ds/icons/Icon';
import { Plus, Database, BookOpen } from 'lucide-react';

export interface EmptyDatasetsTableProps {
  onCreateClick?: () => void;
}

export function EmptyDatasetsTable({ onCreateClick }: EmptyDatasetsTableProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<Database className="size-10 text-neutral3" />}
        titleSlot="No Datasets Yet"
        descriptionSlot="Create your first dataset to start evaluating your agents and workflows."
        actionSlot={
          <div className="flex flex-col sm:flex-row gap-2">
            {onCreateClick && (
              <Button size="lg" variant="light" onClick={onCreateClick}>
                <Icon>
                  <Plus />
                </Icon>
                Create Dataset
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              as="a"
              href="https://mastra.ai/docs/evals"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon>
                <BookOpen />
              </Icon>
              Documentation
            </Button>
          </div>
        }
      />
    </div>
  );
}
