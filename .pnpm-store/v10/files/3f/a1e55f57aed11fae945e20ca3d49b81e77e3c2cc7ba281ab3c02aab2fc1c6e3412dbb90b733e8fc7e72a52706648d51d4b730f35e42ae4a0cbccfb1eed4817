/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2022 Google Inc.
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
import { App } from '../app';
import { CloudEvent } from './cloudevent';
/**
 * Channel options interface.
 */
export interface ChannelOptions {
    /**
     * An array of allowed event types. If specified, publishing events of
     * unknown types is a no op. When not provided, no event filtering is
     * performed.
     */
    allowedEventTypes?: string[] | string | undefined;
}
/**
 * Eventarc service bound to the provided app.
 */
export declare class Eventarc {
    private readonly appInternal;
    /**
     * The {@link firebase-admin.app#App} associated with the current Eventarc service
     * instance.
     *
     * @example
     * ```javascript
     * var app = eventarc.app;
     * ```
     */
    get app(): App;
    /**
     * Creates a reference to the Eventarc channel using the provided channel resource name.
     * The channel resource name can be either:
     *
     * - A fully qualified channel resource name:
     *     `projects/{project}/locations/{location}/channels/{channel-id}`
     *
     * - A partial resource name with location and channel ID, in which case
     *     the runtime project ID of the function is used:
     *     `locations/{location}/channels/{channel-id}`
     *
     * - A partial channel ID, in which case the runtime project ID of the
     *     function and `us-central1` as location is used:
     *     `{channel-id}`
     *
     * @param name - Channel resource name.
     * @param options - (optional) additional channel options
     * @returns An Eventarc channel reference for publishing events.
     */
    channel(name: string, options?: ChannelOptions): Channel;
    /**
     * Create a reference to the default Firebase channel:
     * `locations/us-central1/channels/firebase`
     *
     * @param options - (optional) additional channel options
     * @returns Eventarc channel reference for publishing events.
     */
    channel(options?: ChannelOptions): Channel;
}
/**
 * Eventarc Channel.
 */
export declare class Channel {
    private readonly eventarcInternal;
    private nameInternal;
    /**
     * List of event types allowed by this channel for publishing. Other event types are ignored.
     */
    readonly allowedEventTypes?: string[];
    private readonly client;
    /**
     * The {@link firebase-admin.eventarc#Eventarc} service instance associated with the current `Channel`.
     *
     * @example
     * ```javascript
     * var app = channel.eventarc;
     * ```
     */
    get eventarc(): Eventarc;
    /**
     * The channel name as provided during channel creation. If it was not specifed, the default channel name is returned
     * ('locations/us-central1/channels/firebase').
     */
    get name(): string;
    /**
     * Publishes provided events to this channel. If channel was created with `allowedEventTypes` and event type is not
     * on that list, the event is ignored.
     *
     * @param events - CloudEvent to publish to the channel.
     */
    publish(events: CloudEvent | CloudEvent[]): Promise<void>;
}
