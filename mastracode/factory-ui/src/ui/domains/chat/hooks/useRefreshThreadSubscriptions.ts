import { useSessionHost } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import { useEffect, useRef } from 'react';

import type { ChangeRequestProvider } from '@internal/factory-contract';
import { useChatSessionContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatSessionContext';
import { useChatTranscript } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/useChatTranscript';
import type { TranscriptState } from '@mastra/playground-ui/domains/factory/session/thread/chat/services/transcript';

function notificationKey(entries: TranscriptState['entries']): string {
  return entries
    .flatMap(entry => {
      if (entry.kind === 'notification') return [entry.notificationId];
      if (entry.kind !== 'message') return [];
      const content = entry.message.content.metadata?.harnessContent;
      if (!Array.isArray(content)) return [];
      return content.flatMap(part =>
        typeof part === 'object' && part !== null && 'type' in part && part.type === 'notification'
          ? ['notificationId' in part ? part.notificationId : undefined]
          : [],
      );
    })
    .filter(id => typeof id === 'string')
    .join(':');
}

export function useRefreshThreadSubscriptions(
  threadId: string | undefined,
  enabled: boolean,
  provider: ChangeRequestProvider = 'github',
) {
  const { sessionId } = useChatSessionContext();
  const { transcript, busy } = useChatTranscript();
  const pullRequestSubscriptions = useSessionHost().data.pullRequestSubscriptions;
  const notificationIds = notificationKey(transcript.entries);
  const sessionKey = `${sessionId}:${threadId}`;
  const previous = useRef({ busy, notificationIds, sessionKey });
  const active = enabled && Boolean(threadId);

  useEffect(() => {
    const seen = previous.current;
    previous.current = { busy, notificationIds, sessionKey };

    // another session's values, nothing to compare against — the new key fetches on its own
    if (seen.sessionKey !== sessionKey) return;

    const runSettled = seen.busy && !busy;
    const newNotification = seen.notificationIds !== notificationIds;
    if (!runSettled && !newNotification) return;
    if (!active) return;
    pullRequestSubscriptions?.invalidate(sessionId, threadId, provider);
  }, [active, busy, notificationIds, provider, pullRequestSubscriptions, sessionId, sessionKey, threadId]);
}
