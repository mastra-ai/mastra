import { MessagePrimitive, useMessage } from '@assistant-ui/react';
import { Tooltip, TooltipContent, TooltipTrigger, cn } from '@mastra/playground-ui';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';
import { DatasetSaveAction } from './dataset-save-action';
import { SystemReminderBadge } from './system-reminder-badge';

/**
 * The converter stamps `MastraDBMessage.content.metadata` onto every content
 * part via `getPartMetadata`, and assistant-ui's normalization preserves
 * part-level `metadata` for user text parts. Read the optimistic `pending`
 * status from there (not message-level metadata, which is reduced to `custom`).
 */
const isPendingMessage = (parts: ReadonlyArray<unknown>): boolean =>
  parts.some(part => {
    if (!part || typeof part !== 'object' || !('metadata' in part)) return false;
    const { metadata } = part;
    if (!metadata || typeof metadata !== 'object' || !('status' in metadata)) return false;
    return metadata.status === 'pending';
  });
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
  const isPending = isPendingMessage(message?.content ?? []);

  return (
    <MessagePrimitive.Root
      className="w-full flex items-end pb-4 pt-2 flex-col"
      data-message-id={messageId}
      data-message-index={message?.index}
      data-message-pending={isPending ? 'true' : undefined}
    >
      <DatasetSaveAction />
      <div
        className={cn(
          'max-w-[max(366px,70%)] break-words px-4 py-2 text-neutral6 text-ui-lg leading-ui-lg rounded-xl bg-surface3',
          isPending && 'opacity-60 animate-pulse',
        )}
      >
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
              if (p.text.trimStart().startsWith('<system-reminder')) {
                return <SystemReminderBadge text={p.text} />;
              }

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
