import { MessagePrimitive, useMessage } from '@assistant-ui/react';

import { SignalDataPart } from './signal-badge';

/**
 * Renders standalone signal messages (role: 'system' carrying data-signal parts).
 *
 * Signals emitted by processors (state, notification, reactive) are persisted as
 * their own messages and surfaced to the UI as system-role UIMessages with a
 * `data-signal` part. Without a SystemMessage component, assistant-ui falls back
 * to a null renderer and these signals disappear after a page refresh.
 */
export const SystemMessage = () => {
  const data = useMessage();

  return (
    <MessagePrimitive.Root className="max-w-full" data-message-id={data.id} data-message-index={data.index}>
      <MessagePrimitive.Parts
        components={{
          data: { by_name: { signal: SignalDataPart } },
        }}
      />
    </MessagePrimitive.Root>
  );
};
