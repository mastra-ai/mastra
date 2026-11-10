import type { NotificationPriority } from '@mastra/core/notifications';
import type { SignalProviderTarget } from '@mastra/core/signals';

/**
 * Event types Ring delivers to the webhook URL.
 * See https://developer.amazon.com/docs/ring/api-documentation.html#event-types
 */
export type RingEventType =
  | 'button_press'
  | 'motion_detected'
  | 'device_added'
  | 'device_removed'
  | 'device_online'
  | 'device_offline'
  | 'app_integration_added'
  | 'app_integration_removed'
  | 'subscription_activated'
  | 'subscription_deactivated';

/**
 * `sub_type` values on `motion_detected` when Smart Alerts are enabled.
 * Without Smart Alerts, Ring sends `motion`.
 */
export type RingMotionType = 'human' | 'vehicle' | 'package_delivery' | 'other_motion' | 'motion';

/**
 * `sub_type` values on `subscription_activated` and `subscription_deactivated`.
 */
export type RingSubscriptionType = 'paid' | 'trial';

/**
 * A Ring webhook payload.
 */
export type RingWebhookEvent = {
  meta: {
    version: string;
    time: string;
    request_id: string;
    account_id?: string;
  };
  data: {
    id: string;
    type: RingEventType | (string & {});
    attributes: {
      /** Device ID for device events, account ID for app integration events, `subscriptions` for subscription events. */
      source: string;
      /** Subscription ID, on subscription events. */
      source_id?: string;
      /** `devices` for device events, `users` for app integration events. */
      source_type?: string;
      /** Epoch milliseconds. Missing on subscription events. */
      timestamp?: number;
      /** What caused a motion event, or `paid` / `trial` on subscription events. */
      sub_type?: RingMotionType | RingSubscriptionType | (string & {});
      /** Cameras involved, on devices with more than one. */
      component_ids?: string[];
      /** Subscription plan ID, on subscription events. `null` for trials. */
      plan_id?: string | null;
      /** When the billing cycle or trial ends, as an ISO 8601 date, on subscription events. */
      expires_at?: string;
    };
  };
};

/**
 * How a Ring event becomes a notification signal. Set an event to `false` to disable it.
 */
export type RingEventNotification = {
  priority: NotificationPriority;
  summary: string;
  /** Merge repeats of this event into one pending notification (counted by `coalescedCount`). */
  coalesce?: boolean;
  /**
   * Extra attributes the model sees on the notification, merged over the defaults
   * (`deviceId`, `timestamp`, and `motionType` for motion events).
   * Values that aren't strings, numbers, booleans or `null` (e.g. arrays) are dropped.
   */
  attributes?: (event: RingWebhookEvent) => Record<string, unknown>;
};

/**
 * Where a Ring event is delivered. Return a target, or `undefined` to drop the event.
 * Can be async, e.g. to look up which user owns `event.meta.account_id`.
 */
export type RingTargetResolver = (
  event: RingWebhookEvent,
) => SignalProviderTarget | undefined | Promise<SignalProviderTarget | undefined>;

export type RingSignalsOptions = {
  /** Ring app Client ID. Defaults to `RING_CLIENT_ID`. */
  clientId?: string;
  /** Ring app Client Secret. Defaults to `RING_CLIENT_SECRET`. */
  clientSecret?: string;
  /** Ring app HMAC Signature Key, used to verify link nonces and webhook signatures, and to derive the media URL signing key. Defaults to `RING_HMAC_KEY`. */
  hmacKey?: string;
  /** Key used to encrypt stored Ring tokens. Defaults to `MASTRA_ENCRYPTION_KEY`. When unset, tokens are stored unencrypted and a warning is logged. */
  encryptionKey?: string;
  /**
   * Public URL of your Mastra server, used to build shareable snapshot and clip links. Use `http://localhost:4111`
   * (or a tunnel URL) in development and your deployed URL in production. Without it, the tools return no links;
   * the agent still sees snapshots and chat channels still get attachments. Defaults to `RING_BASE_URL`.
   */
  baseUrl?: string;
  /** How long signed snapshot and clip links stay valid, in milliseconds. Defaults to 7 days. */
  mediaUrlTtlMs?: number;
  /** Path prefix for the Ring routes. Defaults to `/ring`. */
  routePrefix?: string;
  /** `User-Agent` sent to the Ring API. Defaults to `MastraRingSignals/1.0`. */
  userAgent?: string;
  /**
   * `Hardware_Id` sent to the Ring API. By default a UUID is generated when an account is linked
   * and stored with that account's tokens.
   */
  hardwareId?: string;
  /**
   * Where events are delivered when no thread has subscribed to the device with `subscribeThread()`.
   * Defaults to `{ resourceId: <agent id>, threadId: <device id> }`.
   */
  target?: SignalProviderTarget | RingTargetResolver;
  /** Override how each event type becomes a notification, or set it to `false` to disable it. */
  events?: Partial<Record<RingEventType, RingEventNotification | false>>;
  /**
   * Guidance added to the agent's system prompt telling it how to handle Ring notifications.
   * The text is fixed, so it doesn't invalidate the prompt cache. Set to `false` to leave it out.
   * Defaults to `DEFAULT_RING_INSTRUCTIONS`.
   */
  instructions?: string | false;
  /**
   * Tools added to the agent. Both tools are enabled by default. Set a tool to `false` to remove it,
   * or to an options object to configure it.
   */
  tools?: RingToolsOptions;
};

/**
 * Whether to send the media as a file attachment in chat channels.
 * `true` attaches on every channel platform, `false` never attaches, and a list of platform names
 * (for example `["imessage", "slack"]`) attaches only on those. Studio, web and API threads never get attachments.
 */
export type RingAttachmentOption = boolean | string[];

/**
 * Largest file to attach, in bytes. A number applies to every platform; an object sets a limit per platform
 * (for example `{ discord: 10_000_000 }`), and unlisted platforms use the 10 MB default.
 * Files over the limit aren't attached, and the agent shares the link instead.
 */
export type RingMaxAttachmentBytesOption = number | Record<string, number>;

export type RingSnapshotToolOptions = {
  /** Send the snapshot as a file attachment in chat channels. Defaults to `true`. The `url` in the tool result is always returned. */
  attachment?: RingAttachmentOption;
  /** Largest snapshot to attach, in bytes. Defaults to 10 MB. */
  maxAttachmentBytes?: RingMaxAttachmentBytesOption;
  /** Pass the image to the model so the agent can describe it. Requires a model that accepts images. Defaults to `true`. */
  visibleToModel?: boolean;
};

export type RingClipToolOptions = {
  /** Send the clip as a file attachment in chat channels. Defaults to `true`. The `url` in the tool result is always returned. */
  attachment?: RingAttachmentOption;
  /** Largest clip to attach, in bytes. Defaults to 10 MB. */
  maxAttachmentBytes?: RingMaxAttachmentBytesOption;
  /** Pass the video to the model so the agent can describe it. Requires a model that accepts video, such as Gemini. Defaults to `false`. */
  visibleToModel?: boolean;
  /** Include audio in clips. Defaults to `true`. */
  audio?: boolean;
  /** Clip length in milliseconds. Defaults to 15 seconds. Capped at Ring's maximum of 15 minutes (900,000 ms). */
  durationMs?: number;
  /** How long to wait for Ring to finish processing the recording, in milliseconds. Defaults to 2 minutes. */
  processingTimeoutMs?: number;
};

export type RingToolsOptions = {
  /** `ring_snapshot`: a still image for an event. Defaults to `true`. */
  snapshot?: boolean | RingSnapshotToolOptions;
  /** `ring_clip`: a video clip for an event. Defaults to `true`. */
  clip?: boolean | RingClipToolOptions;
};

export type RingTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type RingAccount = RingTokens & {
  accountId: string;
  hardwareId: string;
  /** Devices seen for this account, used to pick the right account's tokens for a device. */
  deviceIds: string[];
};
