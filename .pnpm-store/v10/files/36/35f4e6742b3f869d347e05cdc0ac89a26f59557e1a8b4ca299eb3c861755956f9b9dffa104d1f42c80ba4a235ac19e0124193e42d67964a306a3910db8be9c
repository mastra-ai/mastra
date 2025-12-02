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
/**
 * A CloudEvent version.
 */
export type CloudEventVersion = '1.0';
/**
  * A CloudEvent describes event data.
  *
  * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md
  */
export interface CloudEvent {
    /**
     * Identifier for the event. If not provided, it is auto-populated with a UUID.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#id
     */
    id?: string;
    /**
     * Identifies the context in which an event happened. If not provided, the value of `EVENTARC_CLOUD_EVENT_SOURCE`
     * environment variable is used and if that is not set, a validation error is thrown.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#source-1
     */
    source?: string;
    /**
     * The version of the CloudEvents specification which the event uses. If not provided, is set to `1.0` --
     * the only supported value.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#specversion
     */
    specversion?: CloudEventVersion;
    /**
     * Type of the event. Should be prefixed with a reverse-DNS name (`com.my-org.v1.something.happended`).
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#type
     */
    type: string;
    /**
     * Subject (context) of the event in the context of the event producer.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#subject
     */
    subject?: string;
    /**
     * MIME type of the data being sent with the event in the `data` field. Only `application/json` and `text/plain`
     * are currently supported. If not specified, it is automatically inferred from the type of provided data.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#datacontenttype
     */
    datacontenttype?: string;
    /**
     * Timestamp of the event. Must be in ISO time format. If not specified, current time (at the moment of publishing)
     * is used.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#time
     */
    time?: string;
    /**
     * Data payload of the event. Objects are stringified with JSON and strings are be passed along as-is.
     */
    data?: object | string;
    /**
     * Custom attributes/extensions. Must be strings. Added to the event as is.
     *
     * @see https://github.com/cloudevents/spec/blob/v1.0/spec.md#extension-context-attributes
     */
    [key: string]: any;
}
