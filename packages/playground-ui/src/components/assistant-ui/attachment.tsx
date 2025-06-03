'use client';

import { AttachmentPrimitive, ComposerPrimitive, MessagePrimitive, useAttachment } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { CircleXIcon, FileIcon, FileText, PaperclipIcon } from 'lucide-react';
import { PropsWithChildren, useEffect, useState, type FC } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Dialog, DialogTitle, DialogTrigger, DialogOverlay, DialogPortal, DialogContent } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useShallow } from 'zustand/shallow';
import { Icon } from '@/ds/icons';
import { useHasAttachments } from './use-has-attachments';

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const { file, src } = useAttachment(
    useShallow((a): { file?: File; src?: string } => {
      if (a.type !== 'image') return {};
      if (a.file) return { file: a.file };
      const src = a.content?.filter(c => c.type === 'image')[0]?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  return (
    <div className="overflow-hidden w-full">
      <img src={src} className="object-contain aspect-ratio h-full w-full" alt="Preview" />
    </div>
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger className="hover:bg-accent/50 cursor-pointer transition-colors" asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />

        <DialogContent className="max-w-5xl w-full max-h-[80%]">
          <DialogTitle className="aui-sr-only">Image Attachment Preview</DialogTitle>
          <AttachmentPreview src={src} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

const AttachmentThumbnail: FC = () => {
  const isImage = useAttachment(a => a.type === 'image');
  const document = useAttachment(a => (a.type === 'document' ? a : undefined));
  const src = useAttachmentSrc();
  const canRemove = useAttachment(a => a.source !== 'message');

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root className="relative">
          <AttachmentPreviewDialog>
            <TooltipTrigger asChild>
              <div className="h-full w-full aspect-ratio overflow-hidden rounded-lg">
                {isImage ? (
                  <div className="rounded-lg border-sm border-border1 overflow-hidden">
                    <img src={src} className="object-cover aspect-ratio size-16" alt="Preview" height={64} width={64} />
                  </div>
                ) : document?.contentType === 'application/pdf' ? (
                  <div className="rounded-lg border-sm border-border1 flex items-center justify-center">
                    <FileText className="text-accent2" />
                  </div>
                ) : (
                  <div className="rounded-lg border-sm border-border1 flex items-center justify-center">
                    <FileIcon className="text-icon3" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
          </AttachmentPreviewDialog>
          {canRemove && <AttachmentRemove />}
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AttachmentRemove: FC = () => {
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

export const UserMessageAttachments: FC = () => {
  return <MessagePrimitive.Attachments components={{ Attachment: InMessageAttachment }} />;
};

const InMessageAttachment = () => {
  const isImage = useAttachment(a => a.type === 'image');
  const document = useAttachment(a => (a.type === 'document' ? a : undefined));
  const src = useAttachmentSrc();

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root className="relative pt-4">
          <AttachmentPreviewDialog>
            <TooltipTrigger asChild>
              <div className="h-full w-full aspect-ratio overflow-hidden rounded-lg">
                {isImage ? (
                  <div className="rounded-lg border-sm border-border1 overflow-hidden">
                    <img src={src} className="object-cover aspect-ratio max-h-[140px] max-w-[320px]" alt="Preview" />
                  </div>
                ) : document?.contentType === 'application/pdf' ? (
                  <div className="rounded-lg border-sm border-border1 flex items-center justify-center p-4">
                    <FileText className="text-accent2" />
                  </div>
                ) : (
                  <div className="rounded-lg border-sm border-border1 flex items-center justify-center p-4">
                    <FileIcon className="text-icon3" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
          </AttachmentPreviewDialog>
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ComposerAttachments: FC = () => {
  const hasAttachments = useHasAttachments();

  if (!hasAttachments) return null;

  return (
    <div className="flex w-full flex-row items-center gap-4 h-24">
      <ComposerPrimitive.Attachments components={{ Attachment: AttachmentThumbnail }} />
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
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
