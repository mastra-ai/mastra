import { Button } from '@mastra/playground-ui/components/Button';
import { ComposerAttachmentButton } from '@mastra/playground-ui/components/Composer';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { CloudUpload, Link } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useComposerAttachments } from './composer-attachments';

export const AttachFilePopover = () => {
  const urlInputId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const { addFiles, addUrl } = useComposerAttachments();

  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.hidden = true;

    const cleanup = () => {
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
    };

    // Defer cleanup so file change runs before the focus fallback for missing cancel events.
    const onWindowFocus = () => setTimeout(cleanup, 0);

    input.onchange = async () => {
      const fileList = input.files;
      if (fileList && fileList.length > 0) {
        const rejected = await addFiles(fileList);
        setError(
          rejected.length > 0
            ? `Cannot read these files in Studio: ${rejected.join(', ')}. Export spreadsheet data as CSV or upload a text file instead.`
            : '',
        );
        if (rejected.length === 0) setOpen(false);
      }
      cleanup();
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus);
    input.click();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Portaled form submits still bubble through the composer in React.
    e.stopPropagation();

    const formData = new FormData(e.currentTarget);
    const url = formData.get('url-attachment')?.toString().trim();

    if (!url) return;

    try {
      await addUrl(url);
      setOpen(false);
    } catch {
      // addUrl reports the error; keep the picker open for retry.
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={value => {
        setOpen(value);
        setError('');
      }}
    >
      <PopoverTrigger render={<ComposerAttachmentButton tooltip="Add attachment" />} />
      <PopoverContent align="start" className="w-80 p-4">
        {error && <p role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-row items-end gap-2">
          <div className="w-full space-y-1">
            <Label htmlFor={urlInputId} className="text-neutral3 text-ui-md">
              Public URL
            </Label>
            <Input
              type="text"
              name="url-attachment"
              id={urlInputId}
              className="w-full"
              placeholder="https://placehold.co/600x400/png"
            />
          </div>
          <Button type="submit" className="h-8!" variant="default" icon={<Link />}>
            Add
          </Button>
        </form>

        <hr className="border-border1 my-3" />

        <div className="space-y-2">
          <Txt variant="ui-md" className="text-neutral3">
            Or from your computer
          </Txt>
          <button
            type="button"
            onClick={openFilePicker}
            className="border-border1 text-neutral3 hover:bg-surface2 active:bg-surface3 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed"
          >
            <CloudUpload className="size-8" />
            <Txt variant="ui-lg">Add a local file</Txt>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
