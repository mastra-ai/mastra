import { MessagePrimitive } from '@assistant-ui/react';
import { UserMessageAttachments } from './attachment';

export const UserMessage = () => {
  return (
    <MessagePrimitive.Root className="w-full flex items-end pb-4 flex-col">
      {/* <UserActionBar /> */}

      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3">
        <MessagePrimitive.Content />
      </div>

      <UserMessageAttachments />

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
