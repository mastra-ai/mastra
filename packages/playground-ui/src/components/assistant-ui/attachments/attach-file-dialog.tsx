import { useComposerRuntime } from '@assistant-ui/react';

import { Dialog, DialogHeader, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/ds/components/Button';
import { Label } from '@/components/ui/label';
import { Icon } from '@/ds/icons';
import { CloudUpload, Link } from 'lucide-react';
import { Txt } from '@/ds/components/Txt';
import { useComposerAddAttachment } from '../hooks/use-composer-add-attachment';
import { getFileContentType } from '@/lib/file/contentTypeFromUrl';

export interface AttachFileDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const AttachFileDialog = ({ onOpenChange, open }: AttachFileDialogProps) => {
  const composerRuntime = useComposerRuntime();
  const addFilInputAttachment = useComposerAddAttachment({
    onChange: () => onOpenChange(false),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const url = formData.get('url-attachment')?.toString();

    if (url) {
      /**
       * This is a hack.
       * Assistant-ui does not allow to pass anything else than a file to be handled in their internal system.
       * This workaround passes the URL as the filename and so we can use to in the mastra runtime
       * to add the URL in the AI SDK core message by reading assistant-ui's file name (on an empty file :upside_down_face:)
       */
      const file = new File([], url, {
        type: await getFileContentType(url),
      });

      composerRuntime.addAttachment(file);
      onOpenChange(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="bg-surface3">
        <DialogHeader>
          <DialogTitle>Add attachment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-row items-end gap-4">
          <div className="w-full space-y-1">
            <Label htmlFor="url-attachment" className="text-icon3 text-ui-md">
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
          <Button type="submit" className="!h-8" variant="light">
            <Icon>
              <Link />
            </Icon>
            Add
          </Button>
        </form>

        <hr className="my-2 border-sm border-border1" />

        <div className="space-y-2">
          <Txt variant="ui-md" className="text-icon3">
            Or from your computer
          </Txt>
          <button
            onClick={addFilInputAttachment}
            className="w-full h-40 border-sm border-border1 rounded-lg text-icon3 border-dashed flex flex-col items-center justify-center gap-2 hover:bg-surface2 active:bg-surface3"
          >
            <CloudUpload className="size-12" />
            <Txt variant="header-md">Add a local file</Txt>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
