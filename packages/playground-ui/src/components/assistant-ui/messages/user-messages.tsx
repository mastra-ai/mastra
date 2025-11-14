'use client';

import { AttachmentPrimitive, MessagePrimitive, TextMessagePart, useAttachment, useMessage } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useAttachmentSrc } from '../hooks/use-attachment-src';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';

export interface InMessageAttachmentProps {
  type: string;
  contentType?: string;
  nameSlot: React.ReactNode;
  src?: string;
  data?: string;
}

const InMessageAttachment = ({ type, contentType, nameSlot, src, data }: InMessageAttachmentProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-full w-full overflow-hidden rounded-lg">
            {type === 'image' ? (
              <ImageEntry src={src ?? ''} />
            ) : type === 'document' && contentType === 'application/pdf' ? (
              <PdfEntry data={data ?? ''} url={src} />
            ) : (
              <TxtEntry data={data ?? ''} />
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side="top">{nameSlot}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const UserMessage = () => {
  const message = useMessage();
  const messageId = message?.id;

  return (
    <MessagePrimitive.Root className="w-full flex items-end pb-4 flex-col" data-message-id={messageId}>
      {/* <UserActionBar /> */}
      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3">
        <MessagePrimitive.Parts
          components={{
            File: p => {
              const data = p.data;
              const isUrl = data?.startsWith('https://');

              return (
                <InMessageAttachment
                  type="document"
                  contentType={p.mimeType}
                  nameSlot="Unknown filename"
                  src={isUrl ? data : undefined}
                  data={p.data}
                />
              );
            },
            Image: p => {
              return <InMessageAttachment type="image" nameSlot="Unknown filename" src={p.image} />;
            },
            Text: p => {
              if (p.text.includes('<attachment name=')) {
                return (
                  <InMessageAttachment
                    type="document"
                    contentType="text/plain"
                    nameSlot="Unknown filename"
                    src={undefined}
                    data={p.text}
                  />
                );
              }

              return p.text;
            },
          }}
        />
      </div>

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
