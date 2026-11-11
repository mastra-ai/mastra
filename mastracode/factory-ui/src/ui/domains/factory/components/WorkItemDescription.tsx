import { Button } from '@mastra/playground-ui/components/Button';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useUpdateWorkItemMutation } from '../../../../hooks/useWorkItems';
import type { WorkItem } from '../services/workItems';

const MAX_DESCRIPTION_LENGTH = 8000;

/** The card's own description: what its runs start from. Click to edit; blank clears it. */
export function WorkItemDescription({
  item,
  factoryProjectId,
}: {
  item: WorkItem;
  factoryProjectId: string | undefined;
}) {
  const update = useUpdateWorkItemMutation(factoryProjectId);
  const [draft, setDraft] = useState<string>();
  const editing = draft !== undefined;

  const save = async () => {
    if (draft === undefined) return;
    const next = draft.trim();
    if (next !== (item.description ?? '')) {
      await update.mutateAsync({ id: item.id, patch: { description: next || null } });
    }
    setDraft(undefined);
  };

  if (editing) {
    return (
      <form
        aria-label="Edit description"
        className="flex flex-col gap-2"
        onSubmit={event => {
          event.preventDefault();
          void save();
        }}
      >
        <Textarea
          autoFocus
          rows={4}
          size="sm"
          value={draft}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="What needs doing and why"
          aria-label="Description"
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(undefined);
            } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void save();
            }
          }}
        />
        {update.isError && (
          <Txt variant="meta" tone="muted" className="m-0" role="alert">
            The description could not be saved.
          </Txt>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    );
  }

  if (!item.description) {
    return (
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setDraft('')}>
        Add a description
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <MarkdownRenderer className="text-foreground text-caption max-w-none [&>*:first-child]:mt-0">
        {item.description}
      </MarkdownRenderer>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setDraft(item.description ?? '')}
      >
        Edit description
      </Button>
    </div>
  );
}
