'use client';

import { AttachmentPrimitive, MessagePrimitive, TextMessagePart, useAttachment, useMessage } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useAttachmentSrc } from '../hooks/use-attachment-src';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';

const InMessageContextWrapper = () => {
  return (
    <AttachmentPrimitive.Root className="pt-4">
      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3">
        <InMessageAttachmentWrapper />
      </div>
    </AttachmentPrimitive.Root>
  );
};

const InMessageAttachmentWrapper = () => {
  const src = useAttachmentSrc();
  const attachment = useAttachment(a => a);

  if (attachment.type === 'image') {
    return (
      <InMessageAttachment
        type="image"
        contentType={undefined}
        nameSlot={<AttachmentPrimitive.Name />}
        src={src}
        data={undefined}
      />
    );
  }

  if (attachment.contentType === 'application/pdf') {
    const pdfText = (attachment.content as TextMessagePart[])?.[0]?.text;
    return (
      <InMessageAttachment
        type="document"
        contentType={attachment.contentType}
        nameSlot={<AttachmentPrimitive.Name />}
        src={src}
        data={`data:application/pdf;base64,${pdfText}`}
      />
    );
  }

  return (
    <InMessageAttachment
      type={attachment.type}
      contentType={attachment.contentType}
      nameSlot={<AttachmentPrimitive.Name />}
      src={src}
      data={(attachment.content as TextMessagePart[])?.[0]?.text}
    />
  );
};

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
              <PdfEntry data={data ?? ''} />
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

export const UserMessageAttachments = () => {
  return <MessagePrimitive.Attachments components={{ Attachment: InMessageContextWrapper }} />;
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
              return (
                <InMessageAttachment
                  type="document"
                  contentType={p.mimeType}
                  nameSlot="Unknown filename"
                  src={undefined}
                  data={(p as any).image as string} // yeah, for some reasons
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
      <UserMessageAttachments />
      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
