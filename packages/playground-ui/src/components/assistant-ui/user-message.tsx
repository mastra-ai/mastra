import { MessagePrimitive } from '@assistant-ui/react';

export const UserMessage = () => {
  return (
    <MessagePrimitive.Root className="w-full flex justify-end pb-4">
      {/* <UserActionBar /> */}

      <div className="max-w-[366px] px-5 py-3 text-icon6 text-ui-lg leading-ui-lg rounded-lg bg-surface3">
        <MessagePrimitive.Content />
      </div>

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
