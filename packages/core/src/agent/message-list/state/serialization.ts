import { addLegacyGettersToMessage, stripLegacyMessageFields } from '../utils/legacy-fields';
import type { MastraDBMessage } from './types';

/**
 * Serialized form of a MastraDBMessage where Date is converted to string
 */
export type SerializedMessage = Omit<MastraDBMessage, 'createdAt'> & {
  createdAt: string;
};

/**
 * Serialize a message by converting Date to string
 */
export function serializeMessage(message: MastraDBMessage): SerializedMessage {
  const strippedMessage = stripLegacyMessageFields(message);
  return {
    ...strippedMessage,
    createdAt: strippedMessage.createdAt.toISOString(),
  };
}

/**
 * Deserialize a message by converting string back to Date
 */
export function deserializeMessage(message: SerializedMessage): MastraDBMessage {
  return addLegacyGettersToMessage({
    ...message,
    createdAt: new Date(message.createdAt),
  } as MastraDBMessage);
}

/**
 * Serialize an array of messages
 */
export function serializeMessages(messages: MastraDBMessage[]): SerializedMessage[] {
  return messages.map(serializeMessage);
}

/**
 * Deserialize an array of messages
 */
export function deserializeMessages(messages: SerializedMessage[]): MastraDBMessage[] {
  return messages.map(deserializeMessage);
}
