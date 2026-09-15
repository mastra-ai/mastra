import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ClipboardCheck, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RenameExperimentDialog } from '@/domains/experiments/components/rename-experiment-dialog';
import { RerunExperimentButton } from '@/domains/experiments/components/rerun-experiment-button';
import { experimentReviewQueueLink } from '@/lib/app-routing';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentTopAreaProps {
  experiment: DatasetExperiment;
  /** When provided, renders a delete action in the actions menu. */
  onDeleteClick?: () => void;
  /** Contextual actions (e.g. bulk actions for selected results), rendered on the left. */
  children?: React.ReactNode;
}

/**
 * Top area for any Experiment page — page actions first (Rerun leads), then
 * contextual actions (e.g. bulk actions) trailing on the same row. The name lives in the breadcrumbs and the
 * pipeline/metadata in the side rail.
 */
export function ExperimentTopArea({ experiment, onDeleteClick, children }: ExperimentTopAreaProps) {
  const { Link: LinkComponent } = useLinkComponent();
  const [renameOpen, setRenameOpen] = useState(false);

  // The rename route is dataset-scoped, so caller-run experiments without a dataset can't be renamed.
  const canRename = Boolean(experiment.datasetId);
  const hasMenu = canRename || Boolean(onDeleteClick);

  return (
    <PageLayout.TopArea>
      <PageLayout.Row className="items-center justify-start gap-2">
        <ButtonsGroup className="whitespace-nowrap">
          <RerunExperimentButton experiment={experiment} />
          <Button as={LinkComponent} to={experimentReviewQueueLink(experiment.id)} icon={<ClipboardCheck />}>
            Review queue
          </Button>
          {hasMenu && (
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button size="lg" aria-label="Experiment actions menu">
                  <MoreVertical />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="start" className="w-48">
                {canRename && (
                  <DropdownMenu.Item onSelect={() => setRenameOpen(true)}>
                    <Pencil /> Rename Experiment
                  </DropdownMenu.Item>
                )}
                {onDeleteClick && (
                  <DropdownMenu.Item onSelect={onDeleteClick} className="text-red-500 focus:text-red-400">
                    <Trash2 /> Delete Experiment
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu>
          )}
        </ButtonsGroup>
        {children}
      </PageLayout.Row>

      {/* Mounted on demand so the form state is seeded from the experiment each time it opens. */}
      {renameOpen && <RenameExperimentDialog experiment={experiment} open onOpenChange={setRenameOpen} />}
    </PageLayout.TopArea>
  );
}
