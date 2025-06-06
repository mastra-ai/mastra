import { FileContentPartComponent, ImageContentPartComponent, MessagePrimitive, useMessage } from '@assistant-ui/react';

import { ImageEntry, PdfEntry, TxtEntry } from './attachments/primitives';
import { InUserMessageAttachment } from './attachments/in-user-message-attachment';

export const UserMessage = () => {
  return (
    <MessagePrimitive.Root className="w-full flex items-end pb-4 flex-col">
      {/* <UserActionBar /> */}
      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3">
        <MessagePrimitive.Content
          components={{
            File: FileMessage,
            Image: ImageMessage,
            Text: p => (p.text.includes('<attachment') ? <TxtEntry data={p.text} /> : p.text),
          }}
        />
      </div>
      <MessagePrimitive.Attachments components={{ Attachment: InUserMessageAttachment }} />
      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};

const FileMessage: FileContentPartComponent = props => {
  return <PdfEntry data={props.data} />;
};

const ImageMessage: ImageContentPartComponent = props => {
  return <ImageEntry src={props.image} />;
};
