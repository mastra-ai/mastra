import {
  Button,
  Input,
  Label,
  Txt,
  Icon,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogDescription,
  DialogBody,
} from '@mastra/playground-ui';

import { CloudUpload, Link } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { acceptAttributeValue, getAcceptedAttachmentTypes } from './accepted-types';
import { useComposerAttachments } from './composer-attachments';

export interface AttachFileDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const AttachFileDialog = ({ onOpenChange, open }: AttachFileDialogProps) => {
  const { addFiles, addUrl } = useComposerAttachments();
  const [rejectedNames, setRejectedNames] = useState<string[]>([]);
  const acceptedTypes = getAcceptedAttachmentTypes();

  // Clear stale rejection feedback whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setRejectedNames([]);
    }
  }, [open]);

  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.hidden = true;
    const accept = acceptAttributeValue(acceptedTypes);
    if (accept) {
      input.accept = accept;
    }
    document.body.appendChild(input);

    input.onchange = e => {
      const fileList = (e.target as HTMLInputElement).files;
      if (fileList && fileList.length > 0) {
        const rejected = addFiles(fileList);
        setRejectedNames(rejected);
        if (rejected.length === 0) {
          onOpenChange(false);
        }
      }
      document.body.removeChild(input);
    };

    input.oncancel = () => {
      if (!input.files || input.files.length === 0) {
        document.body.removeChild(input);
      }
    };

    input.click();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url-attachment')?.toString();

    if (url) {
      const added = await addUrl(url);
      setRejectedNames(added ? [] : [url]);
      if (added) {
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
          <DialogDescription>Add a file attachment via URL or from your computer</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form onSubmit={handleSubmit} className="flex flex-row items-end gap-4">
            <div className="w-full space-y-1">
              <Label htmlFor="url-attachment" className="text-neutral3 text-ui-md">
                Public URL
              </Label>
              <Input
                type="text"
                name="url-attachment"
                id="url-attachment"
                className="w-full"
                placeholder="https://placehold.co/600x400/png"
              />
            </div>
            <Button type="submit" className="h-8!" variant="default">
              <Icon>
                <Link />
              </Icon>
              Add
            </Button>
          </form>

          <hr className="my-2 border border-border1" />

          <div className="space-y-2">
            <Txt variant="ui-md" className="text-neutral3">
              Or from your computer
            </Txt>
            <button
              type="button"
              onClick={openFilePicker}
              className="w-full h-40 border border-border1 rounded-lg text-neutral3 border-dashed flex flex-col items-center justify-center gap-2 hover:bg-surface2 active:bg-surface3"
            >
              <CloudUpload className="size-12" />
              <Txt variant="header-md">Add a local file</Txt>
            </button>
            {rejectedNames.length > 0 && (
              <Txt variant="ui-md" className="text-accent2" role="alert">
                {`Not an allowed file type: ${rejectedNames.join(', ')}.`}
                {acceptedTypes ? ` Allowed types: ${acceptedTypes.join(', ')}.` : ''}
              </Txt>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
