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
  return {
    ...message,
    createdAt: message.createdAt.toUTCString(),
  };
}

/**
 * Deserialize a message by converting string back to Date
 */
export function deserializeMessage(message: SerializedMessage): MastraDBMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
  } as MastraDBMessage;
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
