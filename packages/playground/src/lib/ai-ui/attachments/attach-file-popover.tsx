import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';

import { CloudUpload, Link, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useComposerAttachments } from './composer-attachments';

/**
 * "+" composer action opening a popover to attach a file via public URL or
 * from the local file system.
 */
export const AttachFilePopover = () => {
  const [open, setOpen] = useState(false);
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

    // Not every browser fires `cancel` for <input type=file>, which would orphan
    // the element in the DOM. The window regains focus when the OS dialog closes
    // either way, so use that as a fallback — deferred so a successful pick's
    // `change` event runs (and reads `files`) before we remove the input.
    const onWindowFocus = () => setTimeout(cleanup, 0);

    input.onchange = e => {
      const fileList = (e.target as HTMLInputElement).files;
      if (fileList && fileList.length > 0) {
        addFiles(fileList);
        setOpen(false);
      }
      cleanup();
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus);
    input.click();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // The popover is portaled out of the composer form in the DOM, but React
    // still bubbles the submit event through the component tree; stop it so
    // adding a URL doesn't also send the chat message.
    e.stopPropagation();

    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url-attachment')?.toString().trim();

    if (!url) return;

    try {
      await addUrl(url);
      setOpen(false);
    } catch {
      // Keep the popover open so the user can correct the URL and retry.
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="icon-md" type="button" tooltip="Add attachment">
          <PlusIcon className="text-neutral3 hover:text-neutral6 h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4">
        <form onSubmit={handleSubmit} className="flex flex-row items-end gap-2">
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
