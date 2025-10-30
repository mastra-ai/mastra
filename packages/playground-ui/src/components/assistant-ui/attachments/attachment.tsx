'use client';

import { AttachmentPrimitive, AttachmentState, ComposerPrimitive, useAttachment } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { CircleXIcon, PaperclipIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { Icon } from '@/ds/icons';
import { useHasAttachments } from '../hooks/use-has-attachments';
import { useAttachmentSrc } from '../hooks/use-attachment-src';
import { ImageEntry, TxtEntry, PdfEntry } from './attachment-preview-dialog';
import Spinner from '@/components/ui/spinner';
import { useLoadBrowserFile } from '../hooks/use-load-browser-file';
import { fileToBase64 } from '@/lib/file/toBase64';

const ComposerTxtAttachment = ({ document }: { document: AttachmentState }) => {
  const { isLoading, text } = useLoadBrowserFile(document.file);

  return (
    <div className="flex items-center justify-center h-full w-full">
      {isLoading ? <Spinner className="animate-spin" /> : <TxtEntry data={text} />}
    </div>
  );
};

const ComposerPdfAttachment = ({ document }: { document: AttachmentState }) => {
  const [state, setState] = useState({ isLoading: false, text: '' });
  useEffect(() => {
    let isCanceled = false;

    const run = async () => {
      if (!document.file) return;
      setState(s => ({ ...s, isLoading: true }));
      const text = await fileToBase64(document.file);
      if (isCanceled) {
        return;
      }
      setState(s => ({ ...s, isLoading: false, text }));
    };
    run();

    return () => {
      isCanceled = true;
    };
  }, [document]);

  const isUrl = document.file?.name.startsWith('https://');

  return (
    <div className="flex items-center justify-center h-full w-full">
      {state.isLoading ? (
        <Spinner className="animate-spin" />
      ) : (
        <PdfEntry data={state.text} url={isUrl ? document.file?.name : undefined} />
      )}
    </div>
  );
};

const AttachmentThumbnail = () => {
  const isImage = useAttachment(a => a.type === 'image');
  const document = useAttachment(a => (a.type === 'document' ? a : undefined));
  const src = useAttachmentSrc();
  const canRemove = useAttachment(a => a.source !== 'message');
  const isUrl = document?.file?.name.startsWith('https://');
  const actualSrc = isUrl ? document?.file?.name : src;

  return (
    <>
      <div className="relative">
        <TooltipProvider>
          <Tooltip>
            <AttachmentPrimitive.Root>
              <TooltipTrigger asChild>
                <div className="overflow-hidden size-16 rounded-lg bg-surface3 border-sm border-border1 ">
                  {isImage ? (
                    <ImageEntry src={actualSrc ?? ''} />
                  ) : document?.contentType === 'application/pdf' ? (
                    <ComposerPdfAttachment document={document} />
                  ) : document ? (
                    <ComposerTxtAttachment document={document} />
                  ) : null}
                </div>
              </TooltipTrigger>
            </AttachmentPrimitive.Root>
            <TooltipContent side="top">
              <AttachmentPrimitive.Name />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {canRemove && <AttachmentRemove />}
      </div>
    </>
  );
};

const AttachmentRemove = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        className="absolute -right-3 -top-3 text-icon3 hover:text-icon6 rounded-full bg-surface1 hover:bg-surface2 rounded-full p-1"
        side="top"
      >
        <Icon>
          <CircleXIcon />
        </Icon>
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const ComposerAttachments = () => {
  const hasAttachments = useHasAttachments();

  if (!hasAttachments) return null;

  return (
    <div className="flex w-full flex-row items-center gap-4 pb-2">
      <ComposerPrimitive.Attachments components={{ Attachment: AttachmentThumbnail }} />
    </div>
  );
};

export const ComposerAddAttachment = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        className="my-2.5 size-8 p-2 transition-opacity ease-in"
        tooltip="Add Attachment"
        variant="ghost"
      >
        <PaperclipIcon />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
