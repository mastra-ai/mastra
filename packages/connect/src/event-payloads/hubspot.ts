/**
 * HubSpot webhook payload types, written by hand from the Webhooks API
 * guide's payload tables
 * (https://developers.hubspot.com/docs/api-reference/latest/webhooks/guide):
 * HubSpot publishes no machine-readable schema for delivered events.
 *
 * HubSpot posts notifications in batches. Connect stores one event per
 * item, so each payload is a single notification.
 */

type HubspotObject = 'company' | 'contact' | 'deal' | 'product' | 'ticket';

/** HubSpot webhook payloads by Connect event type: the notification's `subscriptionType`. */
export type HubspotWebhookPayloads = {
  [T in `${HubspotObject}.${'creation' | 'deletion'}`]: HubspotNotification<T>;
} & {
  [T in `${Exclude<HubspotObject, 'product'>}.associationChange`]: HubspotAssociationChange<T>;
} & {
  [T in `${HubspotObject}.merge`]: HubspotMerge<T>;
} & {
  [T in `${HubspotObject}.propertyChange`]: HubspotPropertyChange<T>;
} & {
  [T in `${HubspotObject}.restore`]: HubspotNotification<T>;
} & {
  'contact.privacyDeletion': HubspotNotification<'contact.privacyDeletion'>;
  'conversation.creation': HubspotNotification<'conversation.creation'>;
  'conversation.deletion': HubspotNotification<'conversation.deletion'>;
  'conversation.newMessage': HubspotNewMessage;
  'conversation.privacyDeletion': HubspotNotification<'conversation.privacyDeletion'>;
  'conversation.propertyChange': HubspotPropertyChange<'conversation.propertyChange'>;
};

/** Fields every notification carries. */
export interface HubspotNotification<Type extends string> {
  /** The subscription type this notification is for. */
  subscriptionType: Type;
  /** The id of the record created, changed or deleted; for conversations, the thread id. */
  objectId: number;
  /** HubSpot's id for the event. HubSpot doesn't guarantee it's unique. */
  eventId: number;
  /** The subscription that triggered the notification. */
  subscriptionId: number;
  /** The HubSpot account the event occurred in. */
  portalId: number;
  /** The id of the app the subscription belongs to. */
  appId: number;
  /** When the event occurred, in Unix milliseconds. */
  occurredAt: number;
  /** Which attempt this is to deliver the notification, from 0. */
  attemptNumber: number;
  /** What made the change, as recorded in property histories (for example `CRM_UI`). */
  changeSource?: string;
}

/** A property changed on a record. */
export interface HubspotPropertyChange<Type extends string> extends HubspotNotification<Type> {
  propertyName: string;
  /** The property's new value. */
  propertyValue: string;
}

/** Records were merged. */
export interface HubspotMerge<Type extends string> extends HubspotNotification<Type> {
  /** The record that remains after the merge. */
  primaryObjectId: number;
  /** The records merged into it. */
  mergedObjectIds: number[];
  /** The id of the record after the merge. */
  newObjectId: number;
  numberOfPropertiesMoved: number;
}

/** An association between two records was added or removed. */
export interface HubspotAssociationChange<Type extends string> extends HubspotNotification<Type> {
  /** For example `CONTACT_TO_COMPANY`. */
  associationType: string;
  fromObjectId: number;
  toObjectId: number;
  /** `true` when the association was removed, `false` when it was added. */
  associationRemoved: boolean;
  /** Whether the record associated to is the primary association. */
  isPrimaryAssociation?: boolean;
}

/** A message was added to a conversation thread. */
export interface HubspotNewMessage extends HubspotNotification<'conversation.newMessage'> {
  messageId: string;
  messageType: 'MESSAGE' | 'COMMENT';
}
