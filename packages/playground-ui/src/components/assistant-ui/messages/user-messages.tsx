'use client';

import { AttachmentPrimitive, MessagePrimitive, TextContentPart, useAttachment, useMessage } from '@assistant-ui/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useAttachmentSrc } from '../hooks/use-attachment-src';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';

const InMessageContextWrapper = () => {
  return (
    <AttachmentPrimitive.Root>
      <InMessageAttachmentWrapper />
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
    const pdfText = (attachment.content as TextContentPart[])?.[0]?.text;
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
      data={(attachment.content as TextContentPart[])?.[0]?.text}
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
              <PdfEntry data={data ?? ''} nameSlot={nameSlot} variant="badge" />
            ) : (
              <TxtEntry data={data ?? ''} nameSlot={nameSlot} variant="badge" />
            )}
          </div>
        </TooltipTrigger>

        <TooltipContent side="top">{nameSlot}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ClientSideAttachments = () => {
  return <MessagePrimitive.Attachments components={{ Attachment: InMessageContextWrapper }} />;
};

const ServerSideAttachments = () => {
  return (
    <MessagePrimitive.Content
      components={{
        File: p => {
          return (
            <InMessageAttachment
              type="document"
              contentType={p.mimeType}
              // @ts-expect-error - TODO: fix this type issue somehow
              nameSlot={p.name}
              src={undefined}
              data={p.data}
            />
          );
        },
        Image: p => {
          return (
            <InMessageAttachment
              type="image" // @ts-expect-error - TODO: fix this type issue somehow
              nameSlot={p.name}
              src={p.image}
            />
          );
        },
        Text: () => null, // We do custom content placement in UserMessage
      }}
    />
  );
};

export const UserMessage = () => {
  const message = useMessage();
  const content = message.content.find(c => c.type === 'text')?.text ?? '';
  return (
    <MessagePrimitive.Root className="w-full flex items-end pb-4 flex-col">
      {/* <UserActionBar /> */}

      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3 flex flex-col gap-2">
        {content}
        <ServerSideAttachments />
        {/* Client side */}
        <ClientSideAttachments />
      </div>

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
