import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Input } from '@/ds/components/Input';
import { Txt } from '@/ds/components/Txt';

/** A working application-owned edit callback for the attachment stories. */
export function ComposerAttachmentEditor({
  name,
  onSave,
  onClose,
}: {
  name: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Edit attachment</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={event => {
            event.preventDefault();
            if (draft.trim()) onSave(draft.trim());
          }}
        >
          <DialogBody>
            <label className="flex flex-col gap-2">
              <Txt as="span" variant="label">
                Filename
              </Txt>
              <Input value={draft} onChange={event => setDraft(event.target.value)} required autoFocus />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!draft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
