import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';

import type { LinkedRepositoryPayload } from '../../workspaces/services/github';

export function RepositoryPickerDialog({
  repositories,
  onClose,
  onSelect,
}: {
  repositories: LinkedRepositoryPayload[];
  onClose: () => void;
  onSelect: (repository: LinkedRepositoryPayload) => void;
}) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent aria-label="Choose repository">
        <DialogHeader>
          <DialogTitle>Choose a repository</DialogTitle>
          <DialogDescription>This work item does not identify a repository. Choose where its run should work.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          {repositories.map(repository => (
            <Button key={repository.projectRepositoryId} variant="default" onClick={() => onSelect(repository)}>
              {repository.slug}
            </Button>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
