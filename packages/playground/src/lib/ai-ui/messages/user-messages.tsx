import { MessagePrimitive, useMessage } from '@assistant-ui/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { BellRing } from 'lucide-react';
import { ImageEntry, PdfEntry, TxtEntry } from '../attachments/attachment-preview-dialog';
import { DatasetSaveAction } from './dataset-save-action';
import { SystemReminderBadge } from './system-reminder-badge';
import type { SystemReminderSignal } from './system-reminder-badge';

/**
 * Pull the structured signal payload off the user message's metadata. The
 * `@mastra/react` `toAssistantUIMessage` helper plumbs the UIMessage-level
 * `metadata` onto `metadata.custom`, so historical signal messages (which
 * project as `role: 'user'`) carry `metadata.custom.signal` from
 * `signalToDBMessage`. Returns `undefined` for normal user-typed messages.
 */
function readSignalFromMessage(custom: Record<string, unknown> | undefined): SystemReminderSignal | undefined {
  if (!custom) return undefined;
  const signal = custom.signal;
  if (!signal || typeof signal !== 'object') return undefined;
  const s = signal as Record<string, unknown>;
  const type = typeof s.type === 'string' ? s.type : undefined;
  const attributes =
    s.attributes && typeof s.attributes === 'object' && !Array.isArray(s.attributes)
      ? (s.attributes as Record<string, unknown>)
      : undefined;
  const providerMetadata = custom.providerMetadata;
  let heartbeat: SystemReminderSignal['heartbeat'];
  if (providerMetadata && typeof providerMetadata === 'object') {
    const mastra = (providerMetadata as Record<string, unknown>).mastra;
    if (mastra && typeof mastra === 'object') {
      const hb = (mastra as Record<string, unknown>).heartbeat;
      if (hb && typeof hb === 'object') {
        const h = hb as Record<string, unknown>;
        heartbeat = {
          scheduleId: typeof h.scheduleId === 'string' ? h.scheduleId : undefined,
          broadcast: typeof h.broadcast === 'string' ? h.broadcast : undefined,
          threadId: typeof h.threadId === 'string' ? h.threadId : undefined,
        };
      }
    }
  }
  return { type, attributes, heartbeat, body: '' };
}
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

  // Historical signal messages project as `role: 'user'` (see AIV5Adapter).
  // `metadata.custom.signal` carries the signal type + attributes; the heartbeat
  // provenance lives in `metadata.custom.providerMetadata.mastra.heartbeat`.
  //
  // Rendering rules:
  //   - `system-reminder` signal → render the structured SystemReminderBadge
  //     (no XML parsing needed).
  //   - `user-message` signal → render as a normal user bubble; if it came
  //     from a heartbeat, show a small heartbeat indicator above the bubble.
  //   - Any signal that came from a heartbeat → heartbeat indicator visible
  //     so the user can tell the message wasn't typed by them.
  const signal = readSignalFromMessage(message?.metadata?.custom);
  const isSystemReminder = signal?.type === 'system-reminder';
  const heartbeat = signal?.heartbeat;
  const signalBody =
    isSystemReminder && message
      ? message.content
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map(p => p.text)
          .join('\n')
      : '';

  return (
    <MessagePrimitive.Root
      className="w-full flex items-end pb-4 pt-2 flex-col"
      data-message-id={messageId}
      data-message-index={message?.index}
    >
      <DatasetSaveAction />
      {heartbeat ? (
        <div
          className="mb-1 inline-flex items-center gap-1 rounded-full bg-surface3 px-2 py-0.5 text-ui-xs leading-ui-xs text-neutral5"
          data-testid="heartbeat-indicator"
        >
          <BellRing className="w-3 h-3" />
          heartbeat
        </div>
      ) : null}
      <div className="max-w-[max(366px,70%)] break-words px-4 py-2 text-neutral6 text-ui-lg leading-ui-lg rounded-xl bg-surface3">
        {isSystemReminder && signal ? (
          // The outer bubble already shows the heartbeat indicator when needed;
          // drop the duplicate pill from inside the badge.
          <SystemReminderBadge signal={{ ...signal, body: signalBody, heartbeat: undefined }} />
        ) : (
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
        )}
      </div>

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
