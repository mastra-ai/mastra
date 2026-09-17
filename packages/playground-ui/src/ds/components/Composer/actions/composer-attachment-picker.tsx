import { CloudUpload, Link } from 'lucide-react';
import { useId } from 'react';
import type { FormEvent } from 'react';
import { ComposerAttachmentButton } from './composer-buttons';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { Txt } from '@/ds/components/Txt';

export interface ComposerAttachmentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseFiles: () => void;
  onSubmitUrl: (url: string) => void;
  error?: string;
}

export function ComposerAttachmentPicker({
  open,
  onOpenChange,
  onChooseFiles,
  onSubmitUrl,
  error,
}: ComposerAttachmentPickerProps) {
  const urlInputId = useId();
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const url = new FormData(event.currentTarget).get('url-attachment')?.toString().trim();
    if (url) onSubmitUrl(url);
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={<ComposerAttachmentButton tooltip="Add attachment" />} />
      <PopoverContent align="start" className="w-80 p-4">
        {error && <p role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-row items-end gap-2">
          <div className="w-full space-y-1">
            <Label htmlFor={urlInputId} className="text-ui-md text-neutral3">
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
            onClick={onChooseFiles}
            className="border-border1 text-neutral3 hover:bg-surface2 active:bg-surface3 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed"
          >
            <CloudUpload className="size-8" />
            <Txt variant="ui-lg">Add a local file</Txt>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
