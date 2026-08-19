import type { Mastra } from '../../../mastra';
import { MessageList } from '../../message-list';

/** The id generator does not survive the serialize/deserialize round-trip a durable run makes on every step. */
export function createRunMessageList({
  mastra,
  threadId,
  resourceId,
}: {
  mastra?: Mastra;
  threadId?: string;
  resourceId?: string;
}): MessageList {
  return new MessageList({ threadId, resourceId, generateMessageId: mastra?.generateId?.bind(mastra) });
}
