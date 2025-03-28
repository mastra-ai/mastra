import { MessagePrimitive } from '@assistant-ui/react';
import { FC } from 'react';

export const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      style={{
        placeItems: 'end',
      }}
      className="grid w-full"
    >
      {/* <UserActionBar /> */}

      <div
        style={{
          maxWidth: '60%',
        }}
        className="bg-primary w-fit text-primary-foreground max-w-[calc(var(--thread-max-width)*0.8)] sm:max-w-[60%] break-words rounded-xl px-3 py-2 text-sm col-start-2 row-start-2"
      >
        <MessagePrimitive.Content />
      </div>

      {/* <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" /> */}
    </MessagePrimitive.Root>
  );
};
