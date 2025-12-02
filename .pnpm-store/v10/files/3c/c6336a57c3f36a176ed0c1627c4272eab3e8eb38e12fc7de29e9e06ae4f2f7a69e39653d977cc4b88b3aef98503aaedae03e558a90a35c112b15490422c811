/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2021 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { FirebaseArrayIndexError, FirebaseError } from '../app/index';
export interface BaseMessage {
    data?: {
        [key: string]: string;
    };
    notification?: Notification;
    android?: AndroidConfig;
    webpush?: WebpushConfig;
    apns?: ApnsConfig;
    fcmOptions?: FcmOptions;
}
export interface TokenMessage extends BaseMessage {
    token: string;
}
export interface TopicMessage extends BaseMessage {
    topic: string;
}
export interface ConditionMessage extends BaseMessage {
    condition: string;
}
/**
 * Payload for the {@link Messaging.send} operation. The payload contains all the fields
 * in the BaseMessage type, and exactly one of token, topic or condition.
 */
export type Message = TokenMessage | TopicMessage | ConditionMessage;
/**
 * Payload for the {@link Messaging.sendEachForMulticast} method. The payload contains all the fields
 * in the BaseMessage type, and a list of tokens.
 */
export interface MulticastMessage extends BaseMessage {
    tokens: string[];
}
/**
   * A notification that can be included in {@link Message}.
   */
export interface Notification {
    /**
     * The title of the notification.
     */
    title?: string;
    /**
     * The notification body
     */
    body?: string;
    /**
     * URL of an image to be displayed in the notification.
     */
    imageUrl?: string;
}
/**
 * Represents platform-independent options for features provided by the FCM SDKs.
 */
export interface FcmOptions {
    /**
     * The label associated with the message's analytics data.
     */
    analyticsLabel?: string;
}
/**
 * Represents the WebPush protocol options that can be included in an
 * {@link Message}.
 */
export interface WebpushConfig {
    /**
     * A collection of WebPush headers. Header values must be strings.
     *
     * See {@link https://tools.ietf.org/html/rfc8030#section-5 | WebPush specification}
     * for supported headers.
     */
    headers?: {
        [key: string]: string;
    };
    /**
     * A collection of data fields.
     */
    data?: {
        [key: string]: string;
    };
    /**
     * A WebPush notification payload to be included in the message.
     */
    notification?: WebpushNotification;
    /**
     * Options for features provided by the FCM SDK for Web.
     */
    fcmOptions?: WebpushFcmOptions;
}
/** Represents options for features provided by the FCM SDK for Web
 * (which are not part of the Webpush standard).
 */
export interface WebpushFcmOptions {
    /**
     * The link to open when the user clicks on the notification.
     * For all URL values, HTTPS is required.
     */
    link?: string;
}
/**
 * Represents the WebPush-specific notification options that can be included in
 * {@link WebpushConfig}. This supports most of the standard
 * options as defined in the Web Notification
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/notification/Notification | specification}.
 */
export interface WebpushNotification {
    /**
     * Title text of the notification.
     */
    title?: string;
    /**
     * An array of notification actions representing the actions
     * available to the user when the notification is presented.
     */
    actions?: Array<{
        /**
         * An action available to the user when the notification is presented
         */
        action: string;
        /**
         * Optional icon for a notification action.
         */
        icon?: string;
        /**
         * Title of the notification action.
         */
        title: string;
    }>;
    /**
     * URL of the image used to represent the notification when there is
     * not enough space to display the notification itself.
     */
    badge?: string;
    /**
     * Body text of the notification.
     */
    body?: string;
    /**
     * Arbitrary data that you want associated with the notification.
     * This can be of any data type.
     */
    data?: any;
    /**
     * The direction in which to display the notification. Must be one
     * of `auto`, `ltr` or `rtl`.
     */
    dir?: 'auto' | 'ltr' | 'rtl';
    /**
     * URL to the notification icon.
     */
    icon?: string;
    /**
     * URL of an image to be displayed in the notification.
     */
    image?: string;
    /**
     * The notification's language as a BCP 47 language tag.
     */
    lang?: string;
    /**
     * A boolean specifying whether the user should be notified after a
     * new notification replaces an old one. Defaults to false.
     */
    renotify?: boolean;
    /**
     * Indicates that a notification should remain active until the user
     * clicks or dismisses it, rather than closing automatically.
     * Defaults to false.
     */
    requireInteraction?: boolean;
    /**
     * A boolean specifying whether the notification should be silent.
     * Defaults to false.
     */
    silent?: boolean;
    /**
     * An identifying tag for the notification.
     */
    tag?: string;
    /**
     * Timestamp of the notification. Refer to
     * https://developer.mozilla.org/en-US/docs/Web/API/notification/timestamp
     * for details.
     */
    timestamp?: number;
    /**
     * A vibration pattern for the device's vibration hardware to emit
     * when the notification fires.
     */
    vibrate?: number | number[];
    [key: string]: any;
}
/**
 * Represents the APNs-specific options that can be included in an
 * {@link Message}. Refer to
 * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html |
 * Apple documentation} for various headers and payload fields supported by APNs.
 */
export interface ApnsConfig {
    /**
     * APN `pushToStartToken` or `pushToken` to start or update live activities.
     */
    liveActivityToken?: string;
    /**
     * A collection of APNs headers. Header values must be strings.
     */
    headers?: {
        [key: string]: string;
    };
    /**
     * An APNs payload to be included in the message.
     */
    payload?: ApnsPayload;
    /**
     * Options for features provided by the FCM SDK for iOS.
     */
    fcmOptions?: ApnsFcmOptions;
}
/**
 * Represents the payload of an APNs message. Mainly consists of the `aps`
 * dictionary. But may also contain other arbitrary custom keys.
 */
export interface ApnsPayload {
    /**
     * The `aps` dictionary to be included in the message.
     */
    aps: Aps;
    [customData: string]: any;
}
/**
 * Represents the {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html |
 * aps dictionary} that is part of APNs messages.
 */
export interface Aps {
    /**
     * Alert to be included in the message. This may be a string or an object of
     * type `admin.messaging.ApsAlert`.
     */
    alert?: string | ApsAlert;
    /**
     * Badge to be displayed with the message. Set to 0 to remove the badge. When
     * not specified, the badge will remain unchanged.
     */
    badge?: number;
    /**
     * Sound to be played with the message.
     */
    sound?: string | CriticalSound;
    /**
     * Specifies whether to configure a background update notification.
     */
    contentAvailable?: boolean;
    /**
     * Specifies whether to set the `mutable-content` property on the message
     * so the clients can modify the notification via app extensions.
     */
    mutableContent?: boolean;
    /**
     * Type of the notification.
     */
    category?: string;
    /**
     * An app-specific identifier for grouping notifications.
     */
    threadId?: string;
    [customData: string]: any;
}
export interface ApsAlert {
    title?: string;
    subtitle?: string;
    body?: string;
    locKey?: string;
    locArgs?: string[];
    titleLocKey?: string;
    titleLocArgs?: string[];
    subtitleLocKey?: string;
    subtitleLocArgs?: string[];
    actionLocKey?: string;
    launchImage?: string;
}
/**
 * Represents a critical sound configuration that can be included in the
 * `aps` dictionary of an APNs payload.
 */
export interface CriticalSound {
    /**
     * The critical alert flag. Set to `true` to enable the critical alert.
     */
    critical?: boolean;
    /**
     * The name of a sound file in the app's main bundle or in the `Library/Sounds`
     * folder of the app's container directory. Specify the string "default" to play
     * the system sound.
     */
    name: string;
    /**
     * The volume for the critical alert's sound. Must be a value between 0.0
     * (silent) and 1.0 (full volume).
     */
    volume?: number;
}
/**
 * Represents options for features provided by the FCM SDK for iOS.
 */
export interface ApnsFcmOptions {
    /**
     * The label associated with the message's analytics data.
     */
    analyticsLabel?: string;
    /**
     * URL of an image to be displayed in the notification.
     */
    imageUrl?: string;
}
/**
 * Represents the Android-specific options that can be included in an
 * {@link Message}.
 */
export interface AndroidConfig {
    /**
     * Collapse key for the message. Collapse key serves as an identifier for a
     * group of messages that can be collapsed, so that only the last message gets
     * sent when delivery can be resumed. A maximum of four different collapse keys
     * may be active at any given time.
     */
    collapseKey?: string;
    /**
     * Priority of the message. Must be either `normal` or `high`.
     */
    priority?: ('high' | 'normal');
    /**
     * Time-to-live duration of the message in milliseconds.
     */
    ttl?: number;
    /**
     * Package name of the application where the registration tokens must match
     * in order to receive the message.
     */
    restrictedPackageName?: string;
    /**
     * A collection of data fields to be included in the message. All values must
     * be strings. When provided, overrides any data fields set on the top-level
     * {@link Message}.
     */
    data?: {
        [key: string]: string;
    };
    /**
     * Android notification to be included in the message.
     */
    notification?: AndroidNotification;
    /**
     * Options for features provided by the FCM SDK for Android.
     */
    fcmOptions?: AndroidFcmOptions;
    /**
    * A boolean indicating whether messages will be allowed to be delivered to
    * the app while the device is in direct boot mode.
    */
    directBootOk?: boolean;
}
/**
  * Represents the Android-specific notification options that can be included in
  * {@link AndroidConfig}.
  */
export interface AndroidNotification {
    /**
     * Title of the Android notification. When provided, overrides the title set via
     * `admin.messaging.Notification`.
     */
    title?: string;
    /**
     * Body of the Android notification. When provided, overrides the body set via
     * `admin.messaging.Notification`.
     */
    body?: string;
    /**
     * Icon resource for the Android notification.
     */
    icon?: string;
    /**
     * Notification icon color in `#rrggbb` format.
     */
    color?: string;
    /**
     * File name of the sound to be played when the device receives the
     * notification.
     */
    sound?: string;
    /**
     * Notification tag. This is an identifier used to replace existing
     * notifications in the notification drawer. If not specified, each request
     * creates a new notification.
     */
    tag?: string;
    /**
     * URL of an image to be displayed in the notification.
     */
    imageUrl?: string;
    /**
     * Action associated with a user click on the notification. If specified, an
     * activity with a matching Intent Filter is launched when a user clicks on the
     * notification.
     */
    clickAction?: string;
    /**
     * Key of the body string in the app's string resource to use to localize the
     * body text.
     *
     */
    bodyLocKey?: string;
    /**
     * An array of resource keys that will be used in place of the format
     * specifiers in `bodyLocKey`.
     */
    bodyLocArgs?: string[];
    /**
     * Key of the title string in the app's string resource to use to localize the
     * title text.
     */
    titleLocKey?: string;
    /**
     * An array of resource keys that will be used in place of the format
     * specifiers in `titleLocKey`.
     */
    titleLocArgs?: string[];
    /**
     * The Android notification channel ID (new in Android O). The app must create
     * a channel with this channel ID before any notification with this channel ID
     * can be received. If you don't send this channel ID in the request, or if the
     * channel ID provided has not yet been created by the app, FCM uses the channel
     * ID specified in the app manifest.
     */
    channelId?: string;
    /**
     * Sets the "ticker" text, which is sent to accessibility services. Prior to
     * API level 21 (Lollipop), sets the text that is displayed in the status bar
     * when the notification first arrives.
     */
    ticker?: string;
    /**
     * When set to `false` or unset, the notification is automatically dismissed when
     * the user clicks it in the panel. When set to `true`, the notification persists
     * even when the user clicks it.
     */
    sticky?: boolean;
    /**
     * For notifications that inform users about events with an absolute time reference, sets
     * the time that the event in the notification occurred. Notifications
     * in the panel are sorted by this time.
     */
    eventTimestamp?: Date;
    /**
     * Sets whether or not this notification is relevant only to the current device.
     * Some notifications can be bridged to other devices for remote display, such as
     * a Wear OS watch. This hint can be set to recommend this notification not be bridged.
     * See {@link https://developer.android.com/training/wearables/notifications/bridger#existing-method-of-preventing-bridging |
     * Wear OS guides}.
     */
    localOnly?: boolean;
    /**
     * Sets the relative priority for this notification. Low-priority notifications
     * may be hidden from the user in certain situations. Note this priority differs
     * from `AndroidMessagePriority`. This priority is processed by the client after
     * the message has been delivered. Whereas `AndroidMessagePriority` is an FCM concept
     * that controls when the message is delivered.
     */
    priority?: ('min' | 'low' | 'default' | 'high' | 'max');
    /**
     * Sets the vibration pattern to use. Pass in an array of milliseconds to
     * turn the vibrator on or off. The first value indicates the duration to wait before
     * turning the vibrator on. The next value indicates the duration to keep the
     * vibrator on. Subsequent values alternate between duration to turn the vibrator
     * off and to turn the vibrator on. If `vibrateTimingsMillis` is set and `defaultVibrateTimings`
     * is set to `true`, the default value is used instead of the user-specified `vibrateTimingsMillis`.
     */
    vibrateTimingsMillis?: number[];
    /**
     * If set to `true`, use the Android framework's default vibrate pattern for the
     * notification. Default values are specified in {@link https://android.googlesource.com/platform/frameworks/base/+/master/core/res/res/values/config.xml |
     * config.xml}. If `defaultVibrateTimings` is set to `true` and `vibrateTimingsMillis` is also set,
     * the default value is used instead of the user-specified `vibrateTimingsMillis`.
     */
    defaultVibrateTimings?: boolean;
    /**
     * If set to `true`, use the Android framework's default sound for the notification.
     * Default values are specified in {@link https://android.googlesource.com/platform/frameworks/base/+/master/core/res/res/values/config.xml |
     * config.xml}.
     */
    defaultSound?: boolean;
    /**
     * Settings to control the notification's LED blinking rate and color if LED is
     * available on the device. The total blinking time is controlled by the OS.
     */
    lightSettings?: LightSettings;
    /**
     * If set to `true`, use the Android framework's default LED light settings
     * for the notification. Default values are specified in {@link https://android.googlesource.com/platform/frameworks/base/+/master/core/res/res/values/config.xml |
     * config.xml}.
     * If `default_light_settings` is set to `true` and `light_settings` is also set,
     * the user-specified `light_settings` is used instead of the default value.
     */
    defaultLightSettings?: boolean;
    /**
     * Sets the visibility of the notification. Must be either `private`, `public`,
     * or `secret`. If unspecified, it remains undefined in the Admin SDK, and
     * defers to the FCM backend's default mapping.
     */
    visibility?: ('private' | 'public' | 'secret');
    /**
     * Sets the number of items this notification represents. May be displayed as a
     * badge count for Launchers that support badging. See {@link https://developer.android.com/training/notify-user/badges |
     * NotificationBadge}.
     * For example, this might be useful if you're using just one notification to
     * represent multiple new messages but you want the count here to represent
     * the number of total new messages. If zero or unspecified, systems
     * that support badging use the default, which is to increment a number
     * displayed on the long-press menu each time a new notification arrives.
     */
    notificationCount?: number;
    /**
     * Sets if this notification should attempt to be proxied. Must be either
     * `allow`, `deny` or `if_priority_lowered`. If unspecified, it remains
     * undefined in the Admin SDK, and defers to the FCM backend's default mapping.
     */
    proxy?: ('allow' | 'deny' | 'if_priority_lowered');
}
/**
  * Represents settings to control notification LED that can be included in
  * {@link AndroidNotification}.
  */
export interface LightSettings {
    /**
     * Required. Sets color of the LED in `#rrggbb` or `#rrggbbaa` format.
     */
    color: string;
    /**
     * Required. Along with `light_off_duration`, defines the blink rate of LED flashes.
     */
    lightOnDurationMillis: number;
    /**
     * Required. Along with `light_on_duration`, defines the blink rate of LED flashes.
     */
    lightOffDurationMillis: number;
}
/**
  * Represents options for features provided by the FCM SDK for Android.
  */
export interface AndroidFcmOptions {
    /**
     * The label associated with the message's analytics data.
     */
    analyticsLabel?: string;
}
/**
 * Interface representing an FCM legacy API data message payload. Data
 * messages let developers send up to 4KB of custom key-value pairs. The
 * keys and values must both be strings. Keys can be any custom string,
 * except for the following reserved strings:
 *
 * <ul>
 *   <li><code>from</code></li>
 *   <li>Anything starting with <code>google.</code></li>
 * </ul>
 *
 * See {@link https://firebase.google.com/docs/cloud-messaging/send-message | Build send requests}
 * for code samples and detailed documentation.
 */
export interface DataMessagePayload {
    [key: string]: string;
}
/**
 * Interface representing an FCM legacy API notification message payload.
 * Notification messages let developers send up to 4KB of predefined
 * key-value pairs. Accepted keys are outlined below.
 *
 * See {@link https://firebase.google.com/docs/cloud-messaging/send-message | Build send requests}
 * for code samples and detailed documentation.
 */
export interface NotificationMessagePayload {
    /**
     * Identifier used to replace existing notifications in the notification drawer.
     *
     * If not specified, each request creates a new notification.
     *
     * If specified and a notification with the same tag is already being shown,
     * the new notification replaces the existing one in the notification drawer.
     *
     * **Platforms:** Android
     */
    tag?: string;
    /**
     * The notification's body text.
     *
     * **Platforms:** iOS, Android, Web
     */
    body?: string;
    /**
     * The notification's icon.
     *
     * **Android:** Sets the notification icon to `myicon` for drawable resource
     * `myicon`. If you don't send this key in the request, FCM displays the
     * launcher icon specified in your app manifest.
     *
     * **Web:** The URL to use for the notification's icon.
     *
     * **Platforms:** Android, Web
     */
    icon?: string;
    /**
     * The value of the badge on the home screen app icon.
     *
     * If not specified, the badge is not changed.
     *
     * If set to `0`, the badge is removed.
     *
     * **Platforms:** iOS
     */
    badge?: string;
    /**
     * The notification icon's color, expressed in `#rrggbb` format.
     *
     * **Platforms:** Android
     */
    color?: string;
    /**
     * The sound to be played when the device receives a notification. Supports
     * "default" for the default notification sound of the device or the filename of a
     * sound resource bundled in the app.
     * Sound files must reside in `/res/raw/`.
     *
     * **Platforms:** Android
     */
    sound?: string;
    /**
     * The notification's title.
     *
     * **Platforms:** iOS, Android, Web
     */
    title?: string;
    /**
     * The key to the body string in the app's string resources to use to localize
     * the body text to the user's current localization.
     *
     * **iOS:** Corresponds to `loc-key` in the APNs payload. See
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html |
     * Payload Key Reference} and
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CreatingtheNotificationPayload.html#//apple_ref/doc/uid/TP40008194-CH10-SW9 |
     * Localizing the Content of Your Remote Notifications} for more information.
     *
     * **Android:** See
     * {@link http://developer.android.com/guide/topics/resources/string-resource.html | String Resources}
     * for more information.
     *
     * **Platforms:** iOS, Android
     */
    bodyLocKey?: string;
    /**
     * Variable string values to be used in place of the format specifiers in
     * `body_loc_key` to use to localize the body text to the user's current
     * localization.
     *
     * The value should be a stringified JSON array.
     *
     * **iOS:** Corresponds to `loc-args` in the APNs payload. See
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html |
     * Payload Key Reference} and
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CreatingtheNotificationPayload.html#//apple_ref/doc/uid/TP40008194-CH10-SW9 |
     * Localizing the Content of Your Remote Notifications} for more information.
     *
     * **Android:** See
     * {@link http://developer.android.com/guide/topics/resources/string-resource.html#FormattingAndStyling |
     * Formatting and Styling} for more information.
     *
     * **Platforms:** iOS, Android
     */
    bodyLocArgs?: string;
    /**
     * Action associated with a user click on the notification. If specified, an
     * activity with a matching Intent Filter is launched when a user clicks on the
     * notification.
     *
     *   * **Platforms:** Android
     */
    clickAction?: string;
    /**
     * The key to the title string in the app's string resources to use to localize
     * the title text to the user's current localization.
     *
     * **iOS:** Corresponds to `title-loc-key` in the APNs payload. See
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html |
     * Payload Key Reference} and
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CreatingtheNotificationPayload.html#//apple_ref/doc/uid/TP40008194-CH10-SW9 |
     * Localizing the Content of Your Remote Notifications} for more information.
     *
     * **Android:** See
     * {@link http://developer.android.com/guide/topics/resources/string-resource.html | String Resources}
     * for more information.
     *
     * **Platforms:** iOS, Android
     */
    titleLocKey?: string;
    /**
     * Variable string values to be used in place of the format specifiers in
     * `title_loc_key` to use to localize the title text to the user's current
     * localization.
     *
     * The value should be a stringified JSON array.
     *
     * **iOS:** Corresponds to `title-loc-args` in the APNs payload. See
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html |
     * Payload Key Reference} and
     * {@link https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CreatingtheNotificationPayload.html#//apple_ref/doc/uid/TP40008194-CH10-SW9 |
     * Localizing the Content of Your Remote Notifications} for more information.
     *
     * **Android:** See
     * {@link http://developer.android.com/guide/topics/resources/string-resource.html#FormattingAndStyling |
     * Formatting and Styling} for more information.
     *
     * **Platforms:** iOS, Android
     */
    titleLocArgs?: string;
    [key: string]: string | undefined;
}
/**
 * Interface representing a Firebase Cloud Messaging message payload. One or
 * both of the `data` and `notification` keys are required.
 *
 * See {@link https://firebase.google.com/docs/cloud-messaging/send-message | Build send requests}
 * for code samples and detailed documentation.
 */
export interface MessagingPayload {
    /**
     * The data message payload.
     */
    data?: DataMessagePayload;
    /**
     * The notification message payload.
     */
    notification?: NotificationMessagePayload;
}
/**
 * Interface representing the options that can be provided when sending a
 * message via the FCM legacy APIs.
 *
 * See {@link https://firebase.google.com/docs/cloud-messaging/send-message | Build send requests}
 * for code samples and detailed documentation.
 */
export interface MessagingOptions {
    /**
     * Whether or not the message should actually be sent. When set to `true`,
     * allows developers to test a request without actually sending a message. When
     * set to `false`, the message will be sent.
     *
     * **Default value:** `false`
     */
    dryRun?: boolean;
    /**
     * The priority of the message. Valid values are `"normal"` and `"high".` On
     * iOS, these correspond to APNs priorities `5` and `10`.
     *
     * By default, notification messages are sent with high priority, and data
     * messages are sent with normal priority. Normal priority optimizes the client
     * app's battery consumption and should be used unless immediate delivery is
     * required. For messages with normal priority, the app may receive the message
     * with unspecified delay.
     *
     * When a message is sent with high priority, it is sent immediately, and the
     * app can wake a sleeping device and open a network connection to your server.
     *
     * For more information, see
     * {@link https://firebase.google.com/docs/cloud-messaging/concept-options#setting-the-priority-of-a-message |
     * Setting the priority of a message}.
     *
     * **Default value:** `"high"` for notification messages, `"normal"` for data
     * messages
     */
    priority?: string;
    /**
     * How long (in seconds) the message should be kept in FCM storage if the device
     * is offline. The maximum time to live supported is four weeks, and the default
     * value is also four weeks. For more information, see
     * {@link https://firebase.google.com/docs/cloud-messaging/concept-options#ttl | Setting the lifespan of a message}.
     *
     * **Default value:** `2419200` (representing four weeks, in seconds)
     */
    timeToLive?: number;
    /**
     * String identifying a group of messages (for example, "Updates Available")
     * that can be collapsed, so that only the last message gets sent when delivery
     * can be resumed. This is used to avoid sending too many of the same messages
     * when the device comes back online or becomes active.
     *
     * There is no guarantee of the order in which messages get sent.
     *
     * A maximum of four different collapse keys is allowed at any given time. This
     * means FCM server can simultaneously store four different
     * send-to-sync messages per client app. If you exceed this number, there is no
     * guarantee which four collapse keys the FCM server will keep.
     *
     * **Default value:** None
     */
    collapseKey?: string;
    /**
     * On iOS, use this field to represent `mutable-content` in the APNs payload.
     * When a notification is sent and this is set to `true`, the content of the
     * notification can be modified before it is displayed, using a
     * {@link https://developer.apple.com/reference/usernotifications/unnotificationserviceextension |
     * Notification Service app extension}.
     *
     * On Android and Web, this parameter will be ignored.
     *
     * **Default value:** `false`
     */
    mutableContent?: boolean;
    /**
     * On iOS, use this field to represent `content-available` in the APNs payload.
     * When a notification or data message is sent and this is set to `true`, an
     * inactive client app is awoken. On Android, data messages wake the app by
     * default. On Chrome, this flag is currently not supported.
     *
     * **Default value:** `false`
     */
    contentAvailable?: boolean;
    /**
     * The package name of the application which the registration tokens must match
     * in order to receive the message.
     *
     * **Default value:** None
     */
    restrictedPackageName?: string;
    [key: string]: any | undefined;
}
/**
 * Interface representing the server response from the
 * {@link Messaging.subscribeToTopic} and {@link Messaging.unsubscribeFromTopic}
 * methods.
 *
 * See
 * {@link https://firebase.google.com/docs/cloud-messaging/manage-topics |
 * Manage topics from the server} for code samples and detailed documentation.
 */
export interface MessagingTopicManagementResponse {
    /**
     * The number of registration tokens that could not be subscribed to the topic
     * and resulted in an error.
     */
    failureCount: number;
    /**
     * The number of registration tokens that were successfully subscribed to the
     * topic.
     */
    successCount: number;
    /**
     * An array of errors corresponding to the provided registration token(s). The
     * length of this array will be equal to {@link MessagingTopicManagementResponse.failureCount}.
     */
    errors: FirebaseArrayIndexError[];
}
/**
 * Interface representing the server response from the
 * {@link Messaging.sendEach} and {@link Messaging.sendEachForMulticast} methods.
 */
export interface BatchResponse {
    /**
     * An array of responses, each corresponding to a message.
     */
    responses: SendResponse[];
    /**
     * The number of messages that were successfully handed off for sending.
     */
    successCount: number;
    /**
     * The number of messages that resulted in errors when sending.
     */
    failureCount: number;
}
/**
 * Interface representing the status of an individual message that was sent as
 * part of a batch request.
 */
export interface SendResponse {
    /**
     * A boolean indicating if the message was successfully handed off to FCM or
     * not. When true, the `messageId` attribute is guaranteed to be set. When
     * false, the `error` attribute is guaranteed to be set.
     */
    success: boolean;
    /**
     * A unique message ID string, if the message was handed off to FCM for
     * delivery.
     *
     */
    messageId?: string;
    /**
     * An error, if the message was not handed off to FCM successfully.
     */
    error?: FirebaseError;
}
