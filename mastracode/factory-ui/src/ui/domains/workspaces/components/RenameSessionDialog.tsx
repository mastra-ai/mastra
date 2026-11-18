import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useRenameSession } from '../hooks/useRenameSession';

/** The server keeps 80 characters. Counted as code points, so an emoji is one, not two. */
const MAX_TITLE_LENGTH = 80;

/** How long the server will count the title: it trims it and collapses runs of whitespace first. */
function storedLength(value: string): number {
  return [...value.replace(/\s+/g, ' ').trim()].length;
}

function withinTitleLimit(value: string): string {
  if (storedLength(value) <= MAX_TITLE_LENGTH) return value;
  const characters = [...value];
  while (storedLength(characters.join('')) > MAX_TITLE_LENGTH) characters.pop();
  return characters.join('');
}

export function RenameSessionDialog({
  factoryId,
  sessionId,
  name,
  onClose,
}: {
  factoryId: string;
  sessionId: string;
  /** The session's current name, offered as the starting text. */
  name: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const { mutateAsync, isPending, error } = useRenameSession(factoryId, sessionId);
  const title = draft.trim();

  const save = async () => {
    if (!title || isPending) return;
    if (title === name) return onClose();
    try {
      await mutateAsync(title);
      onClose();
    } catch {}
  };

  const close = () => {
    if (!isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && close()} pending={isPending}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Rename session</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus
            aria-label="Session title"
            value={draft}
            disabled={isPending}
            onFocus={event => event.target.select()}
            onChange={event => setDraft(withinTitleLimit(event.target.value))}
            onKeyDown={event => {
              if (event.key === 'Enter') void save();
            }}
          />
          {error instanceof Error ? (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error.message}
            </Txt>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!title} onConfirm={() => void save()}>
            {isPending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
