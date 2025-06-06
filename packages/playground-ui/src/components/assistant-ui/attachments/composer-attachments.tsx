import { AttachmentPrimitive, AttachmentState, ComposerPrimitive, useAttachment } from '@assistant-ui/react';
import { CircleXIcon } from 'lucide-react';
import { useHasAttachments } from './hooks/use-has-attachments';
import { useAttachmentSrc } from './hooks/use-attachement-src';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageEntry, PdfEntry, TxtEntry } from './primitives';
import { Icon } from '@/ds/icons';
import { TooltipIconButton } from '../tooltip-icon-button';
import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/spinner';
import { useLoadBrowserFile } from './hooks/use-load-browser-file';
import { fileToBase64 } from '@/lib/file';

export const ComposerAttachments = () => {
  const hasAttachments = useHasAttachments();

  if (!hasAttachments) return null;

  return (
    <div className="flex w-full flex-row items-center gap-4 h-24">
      <ComposerPrimitive.Attachments components={{ Attachment: AttachmentThumbnail }} />
    </div>
  );
};

const AttachmentThumbnail = () => {
  const isImage = useAttachment(a => a.type === 'image');
  const document = useAttachment(a => (a.type === 'document' ? a : undefined));
  const src = useAttachmentSrc();
  const canRemove = useAttachment(a => a.source !== 'message');

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root className="relative">
          <TooltipTrigger asChild>
            <div className="h-full w-full aspect-ratio overflow-hidden rounded-lg">
              {isImage ? (
                <ImageEntry src={src ?? ''} className="rounded-lg bg-surface3 overflow-hidden size-16" />
              ) : document?.contentType === 'application/pdf' ? (
                <ComposerPdfAttachment document={document} />
              ) : document ? (
                <ComposerTxtAttachment document={document} />
              ) : null}
            </div>
          </TooltipTrigger>

          {canRemove && <AttachmentRemove />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ComposerTxtAttachment = ({ document }: { document: AttachmentState }) => {
  const { isLoading, text } = useLoadBrowserFile(document.file);

  return (
    <div className="rounded-lg bg-surface3 flex items-center justify-center p-4">
      {isLoading ? <Spinner className="animate-spin" /> : <TxtEntry data={text} />}
    </div>
  );
};

const ComposerPdfAttachment = ({ document }: { document: AttachmentState }) => {
  const [state, setState] = useState({ isLoading: false, text: '' });
  useEffect(() => {
    const run = async () => {
      if (!document.file) return;
      setState(s => ({ ...s, isLoading: true }));
      const text = await fileToBase64(document.file);
      setState(s => ({ ...s, isLoading: false, text }));
    };
    run();
  }, [document]);

  return (
    <div className="rounded-lg bg-surface3 flex items-center justify-center p-4">
      {state.isLoading ? <Spinner className="animate-spin" /> : <PdfEntry data={state.text} />}
    </div>
  );
};

const AttachmentRemove = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        className="absolute -right-3 -top-3 hover:bg-transparent rounded-full bg-surface1 rounded-full p-1"
        side="top"
      >
        <Icon>
          <CircleXIcon />
        </Icon>
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};
