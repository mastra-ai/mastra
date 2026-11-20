export const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
export const AGENT_THREAD_STREAM_TOPIC_PREFIX = 'agent.thread-stream';

/** The key identifying a thread's stream state: `<resourceId>\u0000<threadId>`. */
export function agentThreadStreamKey(resourceId: string | undefined, threadId: string): string {
  return [resourceId ?? '', threadId].join(AGENT_THREAD_KEY_SEPARATOR);
}

/** The pubsub topic carrying a thread's live event stream. */
export function agentThreadStreamTopic(resourceId: string | undefined, threadId: string): string {
  return agentThreadStreamTopicForKey(agentThreadStreamKey(resourceId, threadId));
}

export function agentThreadStreamTopicForKey(key: string): string {
  return `${AGENT_THREAD_STREAM_TOPIC_PREFIX}.${encodeURIComponent(key)}`;
}
