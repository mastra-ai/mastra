import { AttachmentPrimitive, ImageContentPart, TextContentPart, useAttachment } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import { ImageEntry, PdfEntry, TxtEntry } from './primitives';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const InUserMessageAttachment = () => {
  const attachment = useAttachment(a => a);

  return (
    <TooltipProvider>
      <Tooltip>
        <AttachmentPrimitive.Root className="relative pt-4">
          <TooltipTrigger asChild>
            <div className="h-full w-full aspect-ratio overflow-hidden rounded-lg">
              {attachment?.type === 'image' ? (
                <ImageEntry
                  src={(attachment.content as ImageContentPart[])?.[0]?.image ?? ''}
                  className="rounded-lg bg-surface3 overflow-hidden"
                />
              ) : attachment?.type === 'document' && attachment.contentType === 'application/pdf' ? (
                <PdfEntry
                  data={`data:application/pdf;base64,${(attachment.content as TextContentPart[])?.[0]?.text ?? ''}`}
                  className="rounded-lg bg-surface3 flex items-center justify-center p-4"
                />
              ) : (
                <TxtEntry
                  data={(attachment.content as TextContentPart[])?.[0]?.text ?? ''}
                  className="rounded-lg bg-surface3 flex items-center justify-center p-4"
                />
              )}
            </div>
          </TooltipTrigger>
        </AttachmentPrimitive.Root>
        <TooltipContent side="top">
          <AttachmentPrimitive.Name />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
