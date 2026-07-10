import { Notice } from '@mastra/playground-ui/components/Notice';

import { useChatSession } from '../../context/ChatSessionProvider';

export function ConnectionNotice() {
  const { status } = useChatSession();
  if (status !== 'reconnecting' && status !== 'error') return null;

  return (
    <div role="status" aria-live="polite" className="px-3 pt-2">
      <Notice variant={status === 'reconnecting' ? 'warning' : 'destructive'}>
        {status === 'reconnecting'
          ? 'Connection lost — reconnecting…'
          : 'Disconnected. Check the server and reload to reconnect.'}
      </Notice>
    </div>
  );
}
