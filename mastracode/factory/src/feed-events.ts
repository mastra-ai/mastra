/**
 * Wire contract of the project-scoped feed stream: the pubsub topic every
 * replica publishes on, and the attention-touch event the SSE route forwards
 * so clients can stop polling while the stream is up.
 */

import type { PubSub } from '@mastra/core/events';

/** Project-scoped feed channel; dotted to match the pubsub topic convention. */
export function feedTopic(orgId: string, factoryProjectId: string): string {
  return `factory.feed.${orgId}.${factoryProjectId}`;
}

export const ATTENTION_TOUCHED_EVENT = 'factory.attention.touched';

export interface AttentionTouchScope {
  orgId: string;
  factoryProjectId: string;
}

/** A dead broker never fails the write that changed attention. */
export async function touchAttention(pubsub: PubSub, scope: AttentionTouchScope, sourceId: string): Promise<void> {
  try {
    await pubsub.publish(feedTopic(scope.orgId, scope.factoryProjectId), {
      type: ATTENTION_TOUCHED_EVENT,
      runId: sourceId,
      data: {},
    });
  } catch (err) {
    console.warn('[Attention] Failed to publish an attention touch', {
      sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
