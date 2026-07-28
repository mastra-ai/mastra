import { Button } from '@mastra/playground-ui/components/Button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@mastra/playground-ui/components/Drawer';
import { Input } from '@mastra/playground-ui/components/Input';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { useUpsertWorkItemMutation } from '../../../../hooks/useWorkItems';
import type { BoardStageId } from '../stages';

interface CreateWorkItemDrawerProps {
  factoryProjectId: string;
  stage: BoardStageId;
  stageLabel: string;
  onClose: () => void;
}

export function CreateWorkItemDrawer({ factoryProjectId, stage, stageLabel, onClose }: CreateWorkItemDrawerProps) {
  const [title, setTitle] = useState('');
  const createWorkItem = useUpsertWorkItemMutation(factoryProjectId);
  const trimmedTitle = title.trim();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedTitle || createWorkItem.isPending) return;

    createWorkItem.mutate(
      {
        source: 'manual',
        sourceKey: null,
        title: trimmedTitle,
        stages: [stage],
      },
      { onSuccess: onClose },
    );
  };

  const close = () => {
    if (!createWorkItem.isPending) onClose();
  };

  const error = createWorkItem.error instanceof Error ? createWorkItem.error.message : undefined;

  return (
    <Drawer side="right" open onOpenChange={open => !open && close()}>
      <DrawerContent showCloseButton={!createWorkItem.isPending}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} aria-label="Create work item">
          <DrawerHeader>
            <DrawerTitle>Create work item</DrawerTitle>
            <DrawerDescription>Add an item directly to {stageLabel}.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <label htmlFor="work-item-title" className="text-ui-sm text-neutral5 flex flex-col gap-2 font-medium">
              Title
              <Input
                id="work-item-title"
                autoFocus
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="What needs to be done?"
                disabled={createWorkItem.isPending}
              />
            </label>
            {error ? (
              <p className="text-ui-sm text-notice-destructive-fg mt-3" role="alert">
                {error}
              </p>
            ) : null}
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={createWorkItem.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!trimmedTitle || createWorkItem.isPending}>
              {createWorkItem.isPending ? 'Creating…' : 'Create work item'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
