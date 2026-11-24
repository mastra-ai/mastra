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

/**
 * Cuts the text where the stored title would pass the limit. The server trims the title and
 * collapses runs of whitespace before it counts, so whitespace it drops is not counted here.
 */
function withinTitleLimit(value: string): string {
  let counted = 0;
  let end = 0;
  let pendingSpace = false;
  for (const character of value) {
    if (/\s/.test(character)) {
      // Leading whitespace is trimmed; a run elsewhere counts as one space, once text follows it.
      pendingSpace = counted > 0;
    } else {
      const needed = pendingSpace ? 2 : 1;
      if (counted + needed > MAX_TITLE_LENGTH) return value.slice(0, end);
      counted += needed;
      pendingSpace = false;
    }
    end += character.length;
  }
  return value;
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
  const { mutateAsync, isPending, error, reset } = useRenameSession(factoryId, sessionId);
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
            onChange={event => {
              setDraft(withinTitleLimit(event.target.value));
              // The reason shown was for the title just refused, not the one being typed now.
              if (error) reset();
            }}
            onKeyDown={event => {
              // Enter that confirms an input-method candidate is not a save.
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
