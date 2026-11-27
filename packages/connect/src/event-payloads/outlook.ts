/**
 * Outlook webhook payload types, written by hand from Microsoft Graph's
 * `changeNotification` resource
 * (https://learn.microsoft.com/en-us/graph/api/resources/changenotification?view=graph-rest-1.0)
 * and its lifecycle notifications
 * (https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events).
 *
 * Graph posts notifications in batches (`{ value: [...] }`). Connect stores
 * one event per notification, so each payload is a single notification.
 * Connect subscribes Outlook connections to the inbox's messages and the
 * calendar's events, created, updated and deleted.
 */

type OutlookResource = 'event' | 'message';
type OutlookChange = 'created' | 'updated' | 'deleted';
type OutlookLifecycleEvent = 'missed' | 'reauthorizationRequired' | 'subscriptionRemoved';

/**
 * Outlook webhook payloads by Connect event type: the resource's type and
 * the change (`message.created`), or `lifecycle.` and the lifecycle event.
 */
export type OutlookWebhookPayloads = {
  [T in `${OutlookResource}.${OutlookChange}`]: GraphChangeNotification<
    T extends `${string}.${infer Change}` ? Change : never
  >;
} & {
  [T in `lifecycle.${OutlookLifecycleEvent}`]: GraphLifecycleNotification<
    T extends `lifecycle.${infer Event}` ? Event : never
  >;
};

/** A change to a resource Connect subscribed to. */
export interface GraphChangeNotification<Change extends string = string> {
  changeType: Change;
  /** The changed resource's path, relative to `https://graph.microsoft.com`. */
  resource: string;
  /** Which resource changed. */
  resourceData?: GraphResourceData;
  /** The subscription that sent the notification. */
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
  /** The secret Connect set on the subscription; Connect checks it before storing the event. */
  clientState?: string;
  /** Graph's id for the notification, when it sends one. */
  id?: string;
  /** Set only for subscriptions that ask for encrypted resource data, which Connect's don't. */
  encryptedContent?: Record<string, unknown>;
}

/** The changed resource's identity. */
export interface GraphResourceData {
  /** For example `#Microsoft.Graph.Message`. */
  '@odata.type': string;
  '@odata.id'?: string;
  '@odata.etag'?: string;
  id: string;
}

/** News about the subscription itself rather than a resource. */
export interface GraphLifecycleNotification<Event extends string = string> {
  /** `missed`: notifications were dropped, so read changes directly. `reauthorizationRequired`: the subscription needs renewing. `subscriptionRemoved`: Graph removed it. */
  lifecycleEvent: Event;
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  tenantId: string;
  clientState?: string;
  resource?: string;
  resourceData?: GraphResourceData;
}
