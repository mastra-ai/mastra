/*!
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { google } from '../../protos/protos';
import * as tracing from '../telemetry-tracing';
/**
 * Strings are the only allowed values for keys and values in message attributes.
 */
export type Attributes = Record<string, string>;
/**
 * The basic {data, attributes} for a message to be published.
 */
export interface PubsubMessage extends google.pubsub.v1.IPubsubMessage, tracing.MessageWithAttributes {
}
