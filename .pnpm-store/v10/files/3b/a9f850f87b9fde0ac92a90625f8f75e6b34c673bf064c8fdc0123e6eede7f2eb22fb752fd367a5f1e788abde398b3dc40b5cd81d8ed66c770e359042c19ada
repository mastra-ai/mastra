/*!
 * Copyright 2020-2024 Google LLC
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
import { Span } from '@opentelemetry/api';
import { Attributes } from './publisher/pubsub-message';
export { Span };
/**
 * Our Carrier object for propagation is anything with an 'attributes'
 * object, which is one of several possible Message classes. (They're
 * different for publish and subscribe.)
 *
 * Also we add a parentSpan optional member for passing around the
 * actual Span object within the client library. This can be a publish
 * or subscriber span, depending on the context.
 *
 * @private
 */
export interface MessageWithAttributes {
    attributes?: Attributes | null | undefined;
    parentSpan?: Span;
}
export interface AttributeParams {
    topicName?: string;
    subName?: string;
    projectId?: string;
    topicId?: string;
    subId?: string;
}
